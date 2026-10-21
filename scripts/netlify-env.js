/* Life OS — Netlify build script: generate sim/assets/js/env.js
 *
 * Replaces the old Bash heredoc + grep build command, which failed on
 * Windows (`<< was unexpected at this time`). Plain Node.js runs
 * identically on Windows (local Netlify CLI) and Netlify's Linux
 * build environment. No dependencies.
 *
 * Invoked from the Netlify base directory (`sim/`):
 *   node ../scripts/netlify-env.js
 *
 * Reads ONLY these environment variables (never prints their values):
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *
 * Behaviour:
 *   1. Fails (exit 1) when a required variable is missing or empty —
 *      never writes a broken live-mode configuration.
 *   2. Rejects values containing quotes, backslashes, newlines or
 *      other control characters instead of emitting broken JS.
 *   3. Rejects the generated file when it contains a forbidden
 *      server-secret key name (SERVICE_ROLE, DB_URL, DB_PASSWORD,
 *      JWT_SECRET, CLIENT_SECRET) — same guard as the old command.
 *   4. Syntax-checks the generated JavaScript (compile only, the code
 *      is never executed here) before writing it to disk.
 *   5. Writes assets/js/env.js relative to the current directory and
 *      reports only the path, byte length, key names and mode.
 */
'use strict';

var fs = require('fs');
var path = require('path');

var OUT_FILE = path.join('assets', 'js', 'env.js');

var REQUIRED_VARS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

var FORBIDDEN_KEY_NAMES = [
  'SERVICE_ROLE',
  'DB_URL',
  'DB_PASSWORD',
  'JWT_SECRET',
  'CLIENT_SECRET'
];

function fail(message) {
  console.error('netlify-env: ' + message);
  process.exit(1);
}

/* Single-quoted JS string literal encoding. Values are expected to be
   URLs and key tokens, so anything outside a safe allowlist fails the
   build instead of emitting escaped (and possibly broken) output. */
function encodeValue(name, value) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('required environment variable ' + name + ' is missing or empty.');
  }
  if (/[\u0000-\u001f\u007f'\\]/.test(value)) {
    fail(name + ' contains a character that cannot appear in env.js.');
  }
  return "'" + value + "'";
}

function main() {
  var values = {};
  REQUIRED_VARS.forEach(function (name) {
    values[name] = process.env[name];
  });

  var content = 'window.__LIFEOS_ENV__ = {\n' +
    "  LIFEOS_MODE: 'live',\n" +
    '  SUPABASE_URL: ' + encodeValue('SUPABASE_URL', values.SUPABASE_URL) + ',\n' +
    '  SUPABASE_ANON_KEY: ' + encodeValue('SUPABASE_ANON_KEY', values.SUPABASE_ANON_KEY) + '\n' +
    '};\n';

  FORBIDDEN_KEY_NAMES.forEach(function (key) {
    if (content.indexOf(key) !== -1) {
      fail('generated env.js contains forbidden key name ' + key + '.');
    }
  });

  /* Compile-only syntax check: validates the JavaScript without
     executing it (no window object is needed for compilation). */
  try {
    // eslint-disable-next-line no-new-func
    new Function(content);
  } catch (e) {
    fail('generated env.js is not valid JavaScript.');
  }

  /* All checks passed — only now touch the file. */
  try {
    fs.writeFileSync(OUT_FILE, content, 'utf8');
  } catch (e) {
    fail('could not write ' + OUT_FILE + '.');
  }

  console.log('netlify-env: wrote ' + OUT_FILE +
    ' (' + Buffer.byteLength(content, 'utf8') + ' bytes' +
    ', keys: ' + REQUIRED_VARS.join(',') + ', mode: live)');
}

main();
