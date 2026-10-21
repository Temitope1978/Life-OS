/* ============================================================
   NOTETAKER ENGINE — Upload -> Transcribe -> Understand ->
   Organise -> Act
   ------------------------------------------------------------
   The processing pipeline behind the meeting assistant. It is
   deliberately honest about what it can and cannot do:

   * INPUT   — a meeting recording (audio/video) or a transcript
                file (.txt/.vtt/.md) or pasted transcript text.
   * TRANSCRIBE — for a TEXT file the text is read for real. For
                AUDIO/VIDEO no transcription provider is configured
                in this build (the provider registry reports
                "not configured" and live calls are not implemented),
                so the engine REFUSES and asks for a transcript.
                It never fabricates a transcript.
   * UNDERSTAND — deterministic rule extraction (the same rule style
                as the commitment engine): decisions, action items,
                commitments, deadlines and follow-ups, each with the
                sentence it came from as evidence.
   * ORGANISE — a meeting record the user can review and edit
                before anything is saved.
   * ACT      — saving is an explicit, user-initiated step; every
                saved meeting belongs to the signed-in account.

   The extraction is rules-based and runs entirely in the browser:
   no provider key is needed and no secret ever reaches the client.
   ============================================================ */
(function () {
  'use strict';

  var MAX_BYTES = 25 * 1024 * 1024;            /* 25 MB, matches the demo limit */
  var TEXT_EXT = /\.(txt|vtt|md|srt|json)$/i;

  var DEADLINE_PATTERNS = [
    /\bby friday\b/i, /\bby monday\b/i, /\bby thursday\b/i, /\bby tuesday\b/i,
    /\bby wednesday\b/i, /\bby next week\b/i, /\bby tomorrow\b/i, /\btomorrow morning\b/i,
    /\btoday\b/i, /\bby end of (the )?week\b/i, /\bby the (\d{1,2})(?:st|nd|rd|th)?\b/i,
    /\bnext week\b/i, /\bby month end\b/i
  ];

  var DECISION_PATTERNS = [
    /\bwe (?:agreed|decided|will go with|are going with)\b/i,
    /\b(?:let'?s|lets) (?:go with|do|use|proceed)\b/i,
    /\bdecision\s*:/i,
    /\bwe(?:'| a)re going with\b/i
  ];

  var ACTION_PATTERNS = [
    /\baction(?: item)?\s*:/i,
    /\b(?:i|we|you)\s+(?:will|'ll|shall|need to|should|must)\b/i,
    /\bplease\s+\w+/i,
    /\bcan you\b/i,
    /\bfollow up\b/i,
    /\bsend\b.{0,40}\bby\b/i
  ];

  var FOLLOWUP_PATTERNS = [
    /\bfollow(?:ing)? up\b/i,
    /\bchase\b/i,
    /\bwaiting (?:on|for)\b/i,
    /\bno response\b/i,
    /\bcircl(?:e|ing) back\b/i
  ];

  function lower(s) { return String(s || '').toLowerCase(); }

  function sentences(text) {
    return String(text || '')
      .split(/(?<=[.!?])\s+|\n+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 3; });
  }

  function matchAny(text, list) {
    for (var i = 0; i < list.length; i++) if (list[i].test(text)) return true;
    return false;
  }

  /* ---------- Input validation ---------- */
  function validateFile(file) {
    if (!file) return { ok: false, error: 'Choose a file to upload.' };
    var name = file.name || '';
    var type = (file.type || '').toLowerCase();
    var isText = TEXT_EXT.test(name) || type.indexOf('text/') === 0 ||
                 type === 'application/json';
    var isMedia = type.indexOf('audio/') === 0 || type.indexOf('video/') === 0 ||
                  /\.(m4a|mp3|wav|webm|mov|mp4|m4v|aac|ogg)$/i.test(name);
    if (!isText && !isMedia) {
      return { ok: false, error: 'That file type is not supported. Upload an audio/video recording or a transcript file (.txt, .vtt, .md).' };
    }
    if (file.size === 0) return { ok: false, error: 'That file is empty.' };
    if (file.size > MAX_BYTES) {
      return { ok: false, error: 'That file is larger than the 25 MB limit.' };
    }
    return { ok: true, kind: isText ? 'transcript' : 'recording', name: name, size: file.size };
  }

  /* ---------- Reading ---------- */
  function readTextFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('The file could not be read.')); };
      reader.readAsText(file);
    });
  }

  /* Transcribe an uploaded file.
     Returns { ok, kind: 'transcript'|'recording', text?, reason? }.
     A recording without a configured provider is refused, never
     faked. */
  function transcribe(file) {
    var v = validateFile(file);
    if (!v.ok) return Promise.resolve({ ok: false, error: v.error });
    if (v.kind === 'recording') {
      var provider = window.Providers && window.Providers.get ? window.Providers.get('transcription') : null;
      var configured = provider && provider.configStatus && provider.configStatus().status === 'CONNECTED';
      if (!configured) {
        return Promise.resolve({
          ok: false,
          kind: 'recording',
          error: 'No transcription provider is configured for this deployment, so the recording ' +
                 'cannot be turned into a transcript here. Paste or upload a transcript file and ' +
                 'the analysis, summary and action items are produced from it.'
        });
      }
      /* A provider IS configured: this build still has no server-side
         transcription endpoint, so say so rather than pretending. */
      return Promise.resolve({
        ok: false,
        kind: 'recording',
        error: 'Transcription needs a server-side endpoint, which this deployment does not expose yet. ' +
               'Upload or paste a transcript to continue.'
      });
    }
    return readTextFile(file).then(function (text) {
      if (!text || !text.trim()) {
        return { ok: false, kind: 'transcript', error: 'That transcript file has no text in it.' };
      }
      return { ok: true, kind: 'transcript', text: text, name: v.name };
    }).catch(function (e) {
      return { ok: false, kind: 'transcript', error: (e && e.message) || 'The file could not be read.' };
    });
  }

  /* ---------- Understanding (deterministic rules) ---------- */
  function analyse(text, meta) {
    meta = meta || {};
    var lines = sentences(text);
    var decisions = [], actionItems = [], deadlines = [], followUps = [];

    lines.forEach(function (line) {
      if (matchAny(line, DECISION_PATTERNS)) decisions.push(line);
      if (matchAny(line, ACTION_PATTERNS)) actionItems.push(line);
      if (matchAny(line, FOLLOWUP_PATTERNS)) followUps.push(line);
      var dl = null;
      for (var i = 0; i < DEADLINE_PATTERNS.length; i++) {
        var m = line.match(DEADLINE_PATTERNS[i]);
        if (m) { dl = m[0]; break; }
      }
      if (dl) deadlines.push({ phrase: dl, evidence: line });
    });

    /* Commitments use the existing commitment engine so the notetaker
       and the meeting view agree on direction and certainty. */
    var commitments = [];
    try {
      if (window.EnginesCommitment && typeof window.EnginesCommitment.extract === 'function') {
        commitments = window.EnginesCommitment.extract(text, { source: { kind: 'meeting', ref: meta.id || null } }) || [];
      }
    } catch (e) { commitments = []; }

    /* An extractive summary: the first substantive lines, never an
       invented narrative. */
    var summaryLines = lines.slice(0, 3).join(' ');
    if (summaryLines.length > 400) summaryLines = summaryLines.slice(0, 397) + '...';

    return {
      summary: summaryLines || '(No transcript text was supplied.)',
      decisions: decisions,
      actionItems: actionItems,
      deadlines: deadlines,
      followUps: followUps,
      commitments: commitments,
      extraction: 'rules',
      processedAt: new Date().toISOString()
    };
  }

  /* ---------- Organise ---------- */
  function buildMeeting(opts) {
    var a = opts.analysis;
    var title = opts.title || 'Meeting recording';
    return {
      id: null,
      title: title,
      date: (window.D && window.D.today) ? window.D.today() : null,
      start: opts.start || null,
      end: opts.end || null,
      contactIds: [],
      audioRef: opts.audioRef || null,
      source: opts.source || 'Recorded in Life OS',
      summary: a.summary,
      decisions: a.decisions,
      actionItems: a.actionItems,
      deadlines: a.deadlines,
      followUps: a.followUps,
      transcript: opts.transcript || [],
      extraction: a.extraction,
      userCreated: true
    };
  }

  window.EnginesNotetaker = {
    MAX_BYTES: MAX_BYTES,
    validateFile: validateFile,
    transcribe: transcribe,
    analyse: analyse,
    buildMeeting: buildMeeting,
    sentences: sentences
  };
})();
