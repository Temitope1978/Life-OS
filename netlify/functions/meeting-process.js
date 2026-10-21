/* ============================================================
   Life OS — server-side meeting processing
   ------------------------------------------------------------
   One endpoint for the two privileged operations the browser
   must never perform:

     action=transcribe  — a private recording is turned into text
     action=analyse     — the text is turned into a structured
                           summary / decisions / action items /
                           commitments / deadlines / follow-ups

   SECURITY MODEL
     * The caller's Supabase access token is verified SERVER-SIDE
       (the Supabase Auth user endpoint) before anything else runs.
       The browser's claim of who it is is never trusted.
     * The user's id comes from the VERIFIED token, never from the
       request body. It is the only thing used for ownership.
     * Provider API keys (OpenAI) and any privileged Supabase
       credential are read from the SERVER environment only. They
       are never returned, logged or echoed.
     * Request payloads are validated: type, size and action.
     * A simple per-user rate limit protects the provider budget.
     * File content is never written to a log.
     * If no provider is configured the endpoint says so plainly
       (503 not_configured). It never fabricates a transcript or a
       summary, and never returns seeded text as a "success".
   ============================================================ */
'use strict';

/* The environment is read AT CALL TIME, not when this module is
   loaded: rotating a key then takes effect immediately, and the
   function can be exercised in a test with a stub provider. */
function openAiKey() { return process.env.OPENAI_API_KEY || ''; }
function openAiBase() { return process.env.OPENAI_API_BASE || 'https://api.openai.com/v1'; }
function aiModel() { return process.env.LIFEOS_AI_MODEL || 'gpt-4o-mini'; }
function transcribeModel() { return process.env.LIFEOS_TRANSCRIBE_MODEL || 'whisper-1'; }
function maxUploadBytes() { return Number(process.env.LIFEOS_MAX_UPLOAD_BYTES || 25 * 1024 * 1024); }
function rateLimitPerMinute() { return Number(process.env.LIFEOS_RATE_LIMIT_PER_MINUTE || 20); }

const AUDIO_TYPES = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/flac', 'audio/mp3'];
const AUDIO_EXT = /\.(webm|ogg|oga|mp3|mp4|m4a|m4b|wav|aac|flac|mkv|mov)$/i;

/* ---------- helpers ---------- */
function json(status, body, extraHeaders) {
  return {
    statusCode: status,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }, extraHeaders || {}),
    body: JSON.stringify(body)
  };
}
function fail(status, code, message) {
  return json(status, { ok: false, error: code, message: message });
}

function base64ToBuffer(b64) {
  return Buffer.from(String(b64 || ''), 'base64');
}

/* Verify the caller's access token with Supabase Auth. Returns the
   verified user object, or null. The public anon key is enough to
   validate a token - no privileged credential is involved. */
async function verifyUser(event) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return { error: 'not_configured' };
  const header = event.headers || {};
  const auth = header.authorization || header.Authorization || '';
  const token = String(auth).replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const res = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token, 'apikey': anon }
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user || !user.id) return null;
    return user;
  } catch (e) {
    return null;
  }
}

/* Per-user rate limit (per function instance). */
const BUCKETS = Object.create(null);
function rateLimited(userId) {
  const now = Date.now();
  const b = BUCKETS[userId] || (BUCKETS[userId] = { start: now, count: 0 });
  if (now - b.start > 60000) { b.start = now; b.count = 0; }
  b.count += 1;
  return b.count > rateLimitPerMinute();
}

/* ---------- transcription ---------- */
async function transcribe(file) {
  if (!openAiKey()) {
    return { error: 'not_configured', message: 'No transcription provider is configured for this deployment.' };
  }
  const buf = file.buffer;
  const form = new FormData();
  form.append('file', new Blob([buf], { type: file.mimeType || 'application/octet-stream' }), file.filename || 'recording');
  form.append('model', transcribeModel());
  form.append('response_format', 'text');
  const res = await fetch(openAiBase() + '/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + openAiKey() },
    body: form
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error && (await res.json()).error.message; } catch (e) { /* no body */ }
    return { error: 'provider_error', message: 'The transcription provider could not process this recording.' + (detail ? ' (' + detail.slice(0, 160) + ')' : '') };
  }
  const text = (await res.text()).trim();
  if (!text) return { error: 'empty_transcript', message: 'The provider returned an empty transcript for this recording.' };
  return { text: text };
}

/* ---------- AI analysis ---------- */
const ANALYSIS_PROMPT = [
  'You turn a meeting transcript into structured notes for a busy professional.',
  'Extract ONLY what the transcript supports. Never invent a decision, deadline,',
  'commitment, speaker or task that is not stated or clearly implied.',
  'Return strict JSON with these keys:',
  'summary (string, max 60 words),',
  'decisions (array of strings),',
  'actionItems (array of strings, each starting with a verb),',
  'commitments (array of objects: description, direction (user_to_others|others_to_user|mutual|possible), dueDate (YYYY-MM-DD or null)),',
  'deadlines (array of objects: phrase, evidence),',
  'followUps (array of strings),',
  'topics (array of strings).',
  'Use an empty array when there is nothing for that key.'
].join(' ');

async function analyse(text) {
  if (!openAiKey()) {
    return { error: 'not_configured', message: 'No AI provider is configured for this deployment.' };
  }
  const res = await fetch(openAiBase() + '/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + openAiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: aiModel(),
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: text.slice(0, 40000) }
      ]
    })
  });
  if (!res.ok) {
    return { error: 'provider_error', message: 'The AI provider could not analyse this content.' };
  }
  const body = await res.json();
  const content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  if (!content) return { error: 'provider_error', message: 'The AI provider returned an empty response.' };
  let parsed;
  try { parsed = JSON.parse(content); } catch (e) {
    return { error: 'provider_error', message: 'The AI provider returned an unreadable response.' };
  }
  return {
    analysis: {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
      deadlines: Array.isArray(parsed.deadlines) ? parsed.deadlines : [],
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      extraction: 'model'
    }
  };
}

/* ---------- handler ---------- */
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {}, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
  }
  if (event.httpMethod !== 'POST') {
    return fail(405, 'method_not_allowed', 'Use POST.');
  }

  const user = await verifyUser(event);
  if (user && user.error === 'not_configured') {
    return fail(503, 'not_configured', 'The server is missing its Supabase configuration.');
  }
  if (!user) {
    return fail(401, 'unauthenticated', 'Sign in again - your session is missing or expired.');
  }
  if (rateLimited(user.id)) {
    return fail(429, 'rate_limited', 'Too many requests. Wait a minute and try again.');
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return fail(400, 'invalid_request', 'The request body was not valid JSON.');
  }

  const action = String(body.action || '');

  try {
    if (action === 'transcribe') {
      const filename = String(body.filename || '');
      const mimeType = String(body.mimeType || '');
      if (!body.contentBase64) return fail(400, 'invalid_request', 'No file content was sent.');
      const isAudio = AUDIO_TYPES.indexOf(mimeType.split(';')[0].trim()) !== -1 || AUDIO_EXT.test(filename);
      if (!isAudio) {
        return fail(415, 'unsupported_media_type',
          'This endpoint transcribes audio. Upload a .txt/.vtt transcript, or a PDF/DOCX document, for text extraction.');
      }
      const buf = base64ToBuffer(body.contentBase64);
      if (!buf.length) return fail(400, 'empty_file', 'The uploaded file was empty.');
      if (buf.length > maxUploadBytes()) {
        return fail(413, 'file_too_large', 'The recording is larger than the ' + Math.round(maxUploadBytes() / 1048576) + ' MB limit.');
      }
      const out = await transcribe({ buffer: buf, filename: filename, mimeType: mimeType });
      if (out.error) return fail(out.error === 'not_configured' ? 503 : 502, out.error, out.message);
      return json(200, { ok: true, action: action, transcript: out.text, userId: user.id });
    }

    if (action === 'analyse') {
      const text = String(body.text || '');
      if (!text.trim()) return fail(400, 'empty_text', 'There is no text to analyse.');
      if (text.length > 200000) return fail(413, 'text_too_long', 'The text is too long to analyse in one request.');
      const out = await analyse(text);
      if (out.error) return fail(out.error === 'not_configured' ? 503 : 502, out.error, out.message);
      return json(200, { ok: true, action: action, analysis: out.analysis, userId: user.id });
    }

    return fail(400, 'invalid_request', 'Unknown action. Use "transcribe" or "analyse".');
  } catch (e) {
    return fail(500, 'server_error', 'The request could not be completed.');
  }
};
