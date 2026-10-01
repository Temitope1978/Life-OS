/* ============================================================
   Commitment Engine — direction, certainty, confidence
   See DEMO BUILD SPEC §6.2
   ------------------------------------------------------------
   HARD RULE: a 'possible' commitment is never promoted to
   'confirmed' without explicit user action.
   ============================================================ */
(function () {
  'use strict';

  var VAGUE = ['when i can', 'asap', 'shortly', 'when possible', 'some time',
               'at some point', 'later'];

  var FIRST = [
    { re: /\b(i(?:'ll| will))\b/i,                          why: "first-person future tense" },
    { re: /\blet me\b/i,                                     why: "first-person offer" },
    { re: /\bi(?:'m| am) going to\b/i,                      why: "first-person intention" }
  ];
  var THIRD = [
    { re: /\byou(?:'ll| will)\b/i,                          why: "second-person future" },
    { re: /\byou said you would\b/i,                        why: "reported second-person promise" }
  ];
  var MUTUAL = [
    { re: /\bwe agreed\b/i,                                  why: "mutual agreement" },
    { re: /\bwe(?:'ll| will)\b/i,                           why: "mutual future" },
    { re: /\blet(?:'s| us)\b/i,                              why: "joint proposal" },
    { re: /\bwe can make\b/i,                                why: "joint agreement" }
  ];

  var DEADLINE_PHRASES = [
    { re: /\bby friday\b/i,      days: 3,  label: 'Friday' },
    { re: /\bfriday\b/i,         days: 3,  label: 'Friday' },
    { re: /\btomorrow morning\b/i, days: 1, label: 'tomorrow morning' },
    { re: /\btomorrow\b/i,       days: 1,  label: 'tomorrow' },
    { re: /\btoday\b/i,          days: 0,  label: 'today' },
    { re: /\bby the (\d{1,2})(?:st|nd|rd|th)?\b/i, days: null, label: null, day: true },
    { re: /\bby next week\b/i,   days: 5,  label: 'next week' },
    { re: /\bnext week\b/i,      days: 5,  label: 'next week' },
    { re: /\bby month end\b/i,   days: 8,  label: 'month end' },
    { re: /\bby end of (?:the )?week\b/i, days: 4, label: 'end of week' }
  ];

  function textOf(input) {
    if (typeof input === 'string') return input;
    if (input && input.transcript) {
      return input.transcript.map(function (t) { return t.spk + ': ' + t.text; }).join('\n');
    }
    if (input && input.turns) {
      return input.turns.map(function (t) { return t.spk + ': ' + t.text; }).join('\n');
    }
    return String(input || '');
  }

  function isVague(t) {
    var l = t.toLowerCase();
    for (var i = 0; i < VAGUE.length; i++) if (l.indexOf(VAGUE[i]) !== -1) return true;
    return false;
  }

  function detectDirection(sentence) {
    var i;
    for (i = 0; i < MUTUAL.length; i++) {
      if (MUTUAL[i].re.test(sentence)) {
        return { direction: 'mutual', why: MUTUAL[i].why };
      }
    }
    for (i = 0; i < FIRST.length; i++) {
      if (FIRST[i].re.test(sentence)) {
        return { direction: 'user_to_others', why: FIRST[i].why };
      }
    }
    for (i = 0; i < THIRD.length; i++) {
      if (THIRD[i].re.test(sentence)) {
        return { direction: 'others_to_user', why: THIRD[i].why };
      }
    }
    /* "<Name> will ..." — third party named in the sentence */
    var named = sentence.match(/\b([A-Z][a-z]{2,}) (?:will|is going to|'ll)\b/);
    if (named && /^(I|We|You)$/i.test(named[1]) === false) {
      return { direction: 'others_to_user', why: 'named party "' + named[1] + '" makes the promise' };
    }
    return null;
  }

  function detectDeadline(sentence) {
    for (var i = 0; i < DEADLINE_PHRASES.length; i++) {
      var m = sentence.match(DEADLINE_PHRASES[i].re);
      if (m) {
        var iso = null;
        if (DEADLINE_PHRASES[i].day) {
          iso = resolveDayOfMonth(parseInt(m[1], 10));
        } else {
          iso = window.D.addDays(window.D.today(), DEADLINE_PHRASES[i].days);
        }
        return { dueDate: iso, phrase: DEADLINE_PHRASES[i].label || m[0] };
      }
    }
    return { dueDate: null, phrase: null };
  }

  /** Resolve "the 20th" to a date in the current month, rolling to next month if past. */
  function resolveDayOfMonth(day) {
    var todayIso = window.D.today();
    var thisMonth = window.D.addDays(todayIso, -(Number(todayIso.slice(8, 10)) - 1) + (day - 1));
    var t = window.D.parse(todayIso);
    var candidate = window.D.parse(thisMonth);
    if (candidate.getMonth() !== t.getMonth()) {
      return window.D.addDays(window.D.addDays(thisMonth, 30), day - 1);
    }
    return thisMonth;
  }

  /**
   * Extract commitments from text.
   * @param {string|object} input  sentence string, or a meeting/turns object
   * @param {object} ctx           { source:{type,ref,label}, speakerName, meetingId }
   * @returns [{ description, direction, dueDate, deadlinePhrase, confidence,
   *             certainty, evidence, why, speaker }]
   */
  function extract(input, ctx) {
    ctx = ctx || {};
    var raw = textOf(input);
    var lines = raw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var out = [];

    lines.forEach(function (line) {
      /* strip the speaker prefix for analysis, keep for evidence */
      var speaker = 'Unknown';
      var sentence = line;
      var spkMatch = line.match(/^([A-Z][A-Z ]+):\s*(.*)$/);
      if (spkMatch) { speaker = spkMatch[1]; sentence = spkMatch[2]; }
      else if (ctx.speakerName) speaker = ctx.speakerName;

      if (!/[.!?]$/.test(sentence)) sentence += '.';

      var dir = detectDirection(sentence);
      if (!dir) return;

      var dl = detectDeadline(sentence);
      var vague = isVague(sentence);

      /* Confidence: firm language + explicit deadline = high. Vague = low. */
      var confidence = 'medium';
      if (dl.dueDate && !vague) confidence = 'high';
      else if (!dl.dueDate && !vague) confidence = 'medium';
      if (vague) confidence = 'low';

      /* Certainty: vague language or no explicit commitment marker = possible */
      var certainty = 'confirmed';
      var qualifiers = [];
      if (vague) { certainty = 'possible'; qualifiers.push('vague timing language (' + (sentence.match(/when i can|asap|shortly|when possible|some time|at some point|later/i) || ['vague'])[0] + ')'); }
      if (!dl.dueDate && certainty === 'confirmed' && /may|might|could|perhaps|probably/i.test(sentence)) {
        certainty = 'possible'; qualifiers.push('hedged language');
      }

      out.push({
        description: sentence.replace(/[.]$/, ''),
        direction: dir.direction,
        directionWhy: dir.why,
        dueDate: dl.dueDate,
        deadlinePhrase: dl.phrase,
        confidence: confidence,
        certainty: certainty,
        qualifiers: qualifiers,
        evidence: line,
        speaker: speaker,
        why: 'Detected via ' + dir.why + (dl.dueDate ? ' and explicit deadline "' + dl.phrase + '"' : ' with no explicit deadline')
      });
    });

    return out;
  }

  /** Extract for a full meeting, tagged with source metadata. */
  function extractForMeeting(meeting) {
    return extract(meeting, {}).map(function (c) {
      c.source = {
        type: 'meeting', ref: meeting.id,
        label: 'Meeting — ' + meeting.title + ', ' + window.D.formatDate(meeting.date)
      };
      return c;
    });
  }

  /** Human label for direction. */
  function directionLabel(d) {
    if (d === 'user_to_others') return 'You → Others';
    if (d === 'others_to_user') return 'Others → You';
    return 'Mutual agreement';
  }

  function directionChip(d) {
    if (d === 'user_to_others') return 'acc';
    if (d === 'others_to_user') return 'warn';
    return 'muted';
  }

  /** Outstanding commitments the user owes (drives "What Did I Promise"). */
  function userOwed() {
    return window.Store.commitments().filter(function (k) {
      return k.direction === 'user_to_others' || k.direction === 'mutual';
    });
  }
  /** Commitments others owe the user (drives "Who Am I Waiting For"). */
  function othersOwed() {
    return window.Store.commitments().filter(function (k) { return k.direction === 'others_to_user'; });
  }

  window.EnginesCommitment = {
    extract: extract,
    extractForMeeting: extractForMeeting,
    directionLabel: directionLabel,
    directionChip: directionChip,
    userOwed: userOwed,
    othersOwed: othersOwed
  };
})();