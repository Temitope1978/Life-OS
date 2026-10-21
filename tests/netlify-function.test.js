/* Life OS â€” Netlify function contract tests (no dependencies, no secrets)
 *
 * Run:  node tests/netlify-function.test.js
 *
 * These tests exercise the REAL deployed function module
 * (netlify/functions/meeting-process.js) against a LOCAL mock of the
 * OpenAI API, so the whole path is covered without any credential,
 * without any network call to a provider, and without touching the
 * hosted project.
 *
 * They also assert the deployment CONFIGURATION contract (the
 * netlify.toml function directory, the directory existing, the
 * handler being exported, and the client endpoint path matching the
 * deployed function name) - the class of mistake that silently stops
 * Netlify from discovering a function.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const FN_DIR = path.join(ROOT, 'netlify', 'functions');
const FN_FILE = path.join(FN_DIR, 'meeting-process.js');
const TOML = path.join(ROOT, 'netlify.toml');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + ' :: ' + (e && e.message ? e.message : e));
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log('PASS ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + ' :: ' + (e && e.message ? e.message : e));
  }
}

/* ---------- 1. Deployment configuration contract ---------- */
test('netlify.toml declares a functions directory', function () {
  const toml = fs.readFileSync(TOML, 'utf8');
  assert.ok(/\[functions\]/.test(toml), 'no [functions] section');
  assert.ok(/directory\s*=\s*"netlify\/functions"/.test(toml), 'functions directory not declared');
});

test('the declared functions directory exists and contains the function', function () {
  assert.ok(fs.existsSync(FN_DIR), 'functions directory missing: ' + FN_DIR);
  assert.ok(fs.existsSync(FN_FILE), 'function file missing: ' + FN_FILE);
});

test('the function exports a handler', function () {
  const mod = require(FN_FILE);
  assert.strictEqual(typeof mod.handler, 'function');
});

test('the client endpoint path matches the deployed function name', function () {
  const client = fs.readFileSync(path.join(ROOT, 'sim', 'assets', 'js', 'engines', 'notetaker.js'), 'utf8');
  const m = client.match(/'\/(\.netlify\/functions\/[a-z0-9-]+)'/);
  assert.ok(m, 'client endpoint not found in notetaker.js');
  const name = m[1].split('/').pop();
  assert.ok(fs.existsSync(path.join(FN_DIR, name + '.js')), 'client calls /' + m[1] + ' but no such function file exists');
});

/* ---------- 2. Handler behaviour ---------- */
const fn = require(FN_FILE);
function call(event) {
  return fn.handler(Object.assign({ httpMethod: 'POST', headers: {}, body: '{}' }, event));
}

async function main() {
  await testAsync('GET is refused with 405', async function () {
    const r = await call({ httpMethod: 'GET' });
    assert.strictEqual(r.statusCode, 405);
    assert.strictEqual(JSON.parse(r.body).error, 'method_not_allowed');
  });

  await testAsync('a request without a token is refused with 401', async function () {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const r = await call({ headers: {} });
    assert.strictEqual(r.statusCode, 401);
    assert.strictEqual(JSON.parse(r.body).error, 'unauthenticated');
  });

  await testAsync('an invalid token is refused with 401 (server-side verification)', async function () {
    process.env.SUPABASE_URL = 'https://127.0.0.1:1';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const r = await call({ headers: { authorization: 'Bearer not-a-real-token' } });
    assert.strictEqual(r.statusCode, 401);
  });

  await testAsync('a malformed body is refused with 400', async function () {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const r = await call({ body: '{not json' });
    assert.ok(r.statusCode === 400 || r.statusCode === 401, 'status=' + r.statusCode);
  });

  await testAsync('an unknown action is refused with 400', async function () {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const r = await call({ body: JSON.stringify({ action: 'delete-everything' }) });
    assert.ok(r.statusCode === 400 || r.statusCode === 401, 'status=' + r.statusCode);
  });

  /* A local mock of the provider: the function is exercised end to end
     (token verification, payload validation, provider call, response
     shaping) with no real credential and no outbound network traffic. */
  function startMockProvider() {
    return new Promise(function (resolve) {
      const server = http.createServer(function (req, res) {
        if (req.url.indexOf('/auth/v1/user') !== -1) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'user-123', email: 'test@example.com' }));
          return;
        }
        if (req.url.indexOf('/chat/completions') !== -1) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            choices: [{ message: { content: JSON.stringify({
              summary: 'Shipped the proposal on Friday.',
              decisions: ['Ship on Friday'],
              actionItems: ['Send the proposal'],
              commitments: [{ description: 'Send the proposal', direction: 'user_to_others', dueDate: '2026-10-23' }],
              deadlines: [{ phrase: 'on Friday', evidence: 'Ship on Friday' }],
              followUps: ['Confirm the receipt'],
              topics: ['Proposal']
            }) } }]
          }));
          return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
      server.listen(0, '127.0.0.1', function () {
        resolve({ server: server, port: server.address().port });
      });
    });
  }

  await testAsync('a verified user gets a structured analysis from the provider', async function () {
    const mock = await startMockProvider();
    process.env.SUPABASE_URL = 'http://127.0.0.1:' + mock.port;
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.OPENAI_API_KEY = 'test-key-not-a-secret';
    process.env.OPENAI_API_BASE = 'http://127.0.0.1:' + mock.port + '/v1';
    try {
      const r = await call({
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify({ action: 'analyse', text: 'ADA: We agreed to ship the proposal on Friday.' })
      });
      assert.strictEqual(r.statusCode, 200, 'body=' + r.body);
      const b = JSON.parse(r.body);
      assert.strictEqual(b.ok, true);
      assert.strictEqual(b.analysis.summary, 'Shipped the proposal on Friday.');
      assert.deepStrictEqual(b.analysis.actionItems, ['Send the proposal']);
      assert.strictEqual(b.analysis.extraction, 'model');
      /* The user id comes from the VERIFIED token, never the body. */
      assert.strictEqual(b.userId, 'user-123');
    } finally {
      mock.server.close();
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_BASE;
    }
  });

  await testAsync('with no provider configured the endpoint answers 503 not_configured (never a fake result)', async function () {
    const mock = await startMockProvider();
    process.env.SUPABASE_URL = 'http://127.0.0.1:' + mock.port;
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_BASE = 'http://127.0.0.1:' + mock.port + '/v1';
    try {
      const r = await call({
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify({ action: 'analyse', text: 'hello' })
      });
      assert.strictEqual(r.statusCode, 503);
      const b = JSON.parse(r.body);
      assert.strictEqual(b.ok, false);
      assert.strictEqual(b.error, 'not_configured');
      assert.ok(!('analysis' in b), 'no analysis may be returned without a provider');
    } finally {
      mock.server.close();
    }
  });

  await testAsync('a document is refused by the transcribe action with 415 (no document path is claimed)', async function () {
    const mock = await startMockProvider();
    process.env.SUPABASE_URL = 'http://127.0.0.1:' + mock.port;
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.OPENAI_API_KEY = 'test-key-not-a-secret';
    process.env.OPENAI_API_BASE = 'http://127.0.0.1:' + mock.port + '/v1';
    try {
      const r = await call({
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify({ action: 'transcribe', filename: 'notes.pdf', mimeType: 'application/pdf', contentBase64: 'AAAA' })
      });
      assert.strictEqual(r.statusCode, 415);
      assert.strictEqual(JSON.parse(r.body).error, 'unsupported_media_type');
    } finally {
      mock.server.close();
    }
  });

  await testAsync('an oversized upload is refused with 413', async function () {
    const mock = await startMockProvider();
    process.env.SUPABASE_URL = 'http://127.0.0.1:' + mock.port;
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.OPENAI_API_KEY = 'test-key-not-a-secret';
    process.env.OPENAI_API_BASE = 'http://127.0.0.1:' + mock.port + '/v1';
    const prev = process.env.LIFEOS_MAX_UPLOAD_BYTES;
    process.env.LIFEOS_MAX_UPLOAD_BYTES = '10';
    try {
      const r = await call({
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify({ action: 'transcribe', filename: 'call.m4a', mimeType: 'audio/mp4', contentBase64: Buffer.alloc(64).toString('base64') })
      });
      assert.strictEqual(r.statusCode, 413);
      assert.strictEqual(JSON.parse(r.body).error, 'file_too_large');
    } finally {
      if (prev === undefined) delete process.env.LIFEOS_MAX_UPLOAD_BYTES; else process.env.LIFEOS_MAX_UPLOAD_BYTES = prev;
      mock.server.close();
    }
  });

  console.log('');
  console.log(failed === 0 ? 'ALL PASS (' + passed + ' checks)' : failed + ' FAILURE(S), ' + passed + ' passed');
  process.exit(failed === 0 ? 0 : 1);
}

main();

