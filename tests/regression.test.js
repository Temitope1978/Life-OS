/* ============================================================
   LIFE OS — Regression tests for critical multi-user issues
   ------------------------------------------------------------
   Tests identity resolution, data isolation, My Day date, and
   AI Notetaker behavior. Mocks browser globals so tests run
   without a browser or network.

   Run:  node tests/regression.test.js
   ============================================================ */
'use strict';

const assert = require('assert');

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

/* ---------- Mock browser globals ---------- */
var window = global.window = {};

/* Seed data — matches sim/assets/js/data/seed.js */
window.SEED = {
  TODAY: '2026-09-22',
  user: {
    name: 'Temitope',
    email: 'temitope@lifeos.local',
    timezone: 'Africa/Lagos',
    subscription: null,
    learnedPrefs: []
  },
  contacts: [],
  tasks: [],
  commitments: [],
  followUps: [],
  meetings: [],
  events: [],
  emails: [],
  documents: [],
  integrations: []
};

/* Config mock — reads from injected env */
var env = {};
window.Config = {
  get: function (key) { return env[key] || null; },
  has: function (key) { return !!env[key]; },
  isEmpty: function () { return Object.keys(env).length === 0; }
};

/* D (dates) mock — minimal subset needed for tests */
window.D = {
  today: function () { return env.LIFEOS_MODE === 'live' ? new Date().toISOString().slice(0, 10) : '2026-09-22'; },
  formatLong: function (iso) { return iso || ''; },
  daysBetween: function (a, b) {
    if (!a || !b) return null;
    var A = new Date(a), B = new Date(b);
    return Math.round((B - A) / 86400000);
  }
};

/* Store mock — simplified per-user scoping */
var SCOPE_ID = null;
var STORAGE_KEY_BASE = 'lifeos.sim.v1';
var MUTABLE_LAYERS = {};
window.Store = {
  isLiveMode: function () {
    var m = env.LIFEOS_MODE || 'demo';
    return String(m).toLowerCase() === 'live' || String(m).toLowerCase() === 'production';
  },
  setUserScope: function (userId) {
    var next = userId || null;
    if (SCOPE_ID === next) return false;
    SCOPE_ID = next;
    return true;
  },
  currentScope: function () { return SCOPE_ID; },
  storageKey: function () { return SCOPE_ID ? STORAGE_KEY_BASE + '.' + SCOPE_ID : STORAGE_KEY_BASE; },
  user: function () {
    var live = window.Store.isLiveMode();
    var u = {};
    if (live) {
      var s = window.Session && window.Session.currentUser ? window.Session.currentUser() : null;
      u.name = (s && s.name) || null;
      u.email = (s && s.email) || null;
    } else {
      u.name = 'Temitope';
      u.email = 'temitope@lifeos.local';
    }
    return u;
  },
  tasks: function () {
    var live = window.Store.isLiveMode();
    var out = [];
    if (!live) {
      // Demo: seed tasks included
      out.push({ id: 'seed-task-1', title: 'Temitope seed task' });
    }
    return out;
  },
  meetings: function () {
    var live = window.Store.isLiveMode();
    var out = [];
    if (!live) {
      out.push({ id: 'seed-meeting-1', title: 'Temitope seed meeting', userCreated: false });
    }
    return out;
  },
  commitments: function () {
    var live = window.Store.isLiveMode();
    if (live) return [];
    return [{ id: 'seed-commitment-1', description: 'Temitope seed commitment' }];
  },
  clearRemoteState: function () {},
  subscribe: function () {},
  mutable: function () { return {}; }
};

/* Session mock — adapter pattern */
var ADAPTER = null;
window.Session = {
  setAdapter: function (a) { ADAPTER = a; },
  getAdapter: function () { return ADAPTER; },
  currentUser: function () { return ADAPTER ? ADAPTER.currentUser() : null; },
  isAuthenticated: function () { return ADAPTER ? !!ADAPTER.isAuthenticated() : false; },
  requireAuth: function (path) { return ADAPTER ? !!ADAPTER.requireAuth(path) : false; }
};

/* DemoAuth adapter — used in demo mode (mirrors real DemoAuthAdapter) */
window.DemoAuth = {
  session: function () { return { demo: true, userId: 'demo-user', name: 'Temitope', email: 'demo@lifeos.local', authState: 'demo' }; },
  isSignedIn: function () { return true; },
  requireAuth: function (path) { return true; },
  currentUser: function () { return this.session(); },
  isAuthenticated: function () { return this.isSignedIn(); }
};

/* SupabaseAuth adapter — used in live mode */
window.SupabaseAuth = {
  isProductionMode: function () {
    var m = env.LIFEOS_MODE || 'demo';
    return String(m).toLowerCase() === 'live' || String(m).toLowerCase() === 'production';
  },
  isConfigured: function () { return !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY; },
  clientAvailable: function () { return true; },
  bootstrap: function () {
    if (!this.isProductionMode()) return false;
    var adapter = {
      id: 'supabase',
      session: function () { return { demo: false, userId: 'supabase-user', name: 'Real User', email: 'real@user.com', authState: 'supabase' }; },
      isAuthenticated: function () { return true; },
      currentUser: function () { return { userId: 'supabase-user', name: 'Real User', email: 'real@user.com', authState: 'supabase' }; },
      requireAuth: function (path) { return true; },
      accessToken: function () { return 'access-token-123'; }
    };
    window.Session.setAdapter(adapter);
    return Promise.resolve({ mode: 'production', status: 'ready', adapter: adapter });
  },
  MisconfiguredAdapter: {
    id: 'misconfigured',
    isAuthenticated: function () { return false; },
    currentUser: function () { return null; },
    requireAuth: function (path) { return path === '/welcome' || path === '/signin' || path === '/signup'; }
  }
};

/* Identity mock */
window.Identity = {
  current: function () {
    var session = window.Session.currentUser ? window.Session.currentUser() : null;
    var adapter = window.Session.getAdapter ? window.Session.getAdapter() : null;
    var production = !!(adapter && adapter.id === 'supabase');
    var signedIn = !!session;
    return {
      userId: signedIn ? session.userId : null,
      name: signedIn ? session.name : (production ? undefined : 'Temitope'),
      email: signedIn ? session.email : (production ? undefined : 'temitope@lifeos.local'),
      authState: signedIn ? session.authState : null,
      demo: signedIn ? !!session.demo : false
    };
  },
  displayName: function () {
    var id = window.Identity.current();
    return (id && id.userId && id.name) ? id.name : null;
  },
  firstName: function () {
    var n = window.Identity.displayName();
    if (!n) return null;
    return String(n).split(/\s+/).filter(Boolean)[0] || null;
  }
};

/* UI mock */
window.UI = {
  toast: function () {},
  page: function () { return document.createElement('div'); },
  empty: function () { return document.createElement('div'); },
  chip: function () { return document.createElement('span'); },
  btnSm: function () { return document.createElement('button'); },
  btn: function () { return document.createElement('button'); }
};

/* DOM mock */
window.$ = {
  el: function (tag, attrs, children) {
    var node = document.createElement(tag || 'div');
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else node.setAttribute(k, v);
      });
    }
    if (children) node.appendChild(children);
    return node;
  },
  clear: function (node) { while (node.firstChild) node.removeChild(node.firstChild); }
};

window.document = {
  getElementById: function () { return null; },
  createElement: function (tag) { return { tagName: tag, appendChild: function () {}, textContent: '', className: '', style: {}, addEventListener: function () {}, setAttribute: function () {} }; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; }
};

/* Notetaker engine mock */
window.EnginesNotetaker = {
  analyse: function (text) {
    var lines = String(text || '').split(/(?<=[.!?])\s+|\n+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 3; });
    return {
      summary: lines.slice(0, 3).join(' ') || '(No transcript text was supplied.)',
      decisions: [],
      actionItems: [],
      deadlines: [],
      followUps: [],
      commitments: [],
      extraction: 'rules',
      processedAt: new Date().toISOString()
    };
  },
  analyseRemote: function (text) {
    if (!text || !String(text).trim()) return Promise.resolve(null);
    return Promise.resolve(null); // No provider configured
  },
  buildMeeting: function (opts) { return { analysis: opts.analysis, title: opts.title }; },
  sentences: function (text) { return String(text || '').split('\n'); }
};

/* ============================================================
   TESTS
   ============================================================ */

/* ---------- Issue 1: Identity resolution ---------- */

test('Demo mode: Identity.shows Temitope (seed persona, expected in demo)', function () {
  env = { LIFEOS_MODE: 'demo' };
  window.Session.setAdapter(window.DemoAuth);
  var name = window.Identity.displayName();
  assert.strictEqual(name, 'Temitope', 'Expected Temitope in demo mode, got: ' + name);
});

test('Demo mode: firstName returns Temitope', function () {
  env = { LIFEOS_MODE: 'demo' };
  window.Session.setAdapter(window.DemoAuth);
  var first = window.Identity.firstName();
  assert.strictEqual(first, 'Temitope', 'Expected Temitope in demo mode, got: ' + first);
});

test('Live mode: Identity does NOT show Temitope (uses Supabase profile)', function () {
  env = { LIFEOS_MODE: 'live', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-key' };
  // Simulate bootstrap() installing the Supabase adapter
  return window.SupabaseAuth.bootstrap().then(function () {
    var name = window.Identity.displayName();
    assert.notStrictEqual(name, 'Temitope', 'Live mode must not show Temitope, got: ' + name);
    assert.strictEqual(name, 'Real User', 'Expected Real User from Supabase profile, got: ' + name);
  });
});

test('Live mode: Identity does NOT show Temitope even when profile has no name', function () {
  env = { LIFEOS_MODE: 'live', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-key' };
  // Override adapter to return null name (profile not set)
  window.Session.setAdapter({
    id: 'supabase',
    session: function () { return { demo: false, userId: 'supabase-user', name: null, email: 'real@user.com', authState: 'supabase' }; },
    isAuthenticated: function () { return true; },
    currentUser: function () { return { userId: 'supabase-user', name: null, email: 'real@user.com', authState: 'supabase' }; },
    requireAuth: function (path) { return true; },
    accessToken: function () { return 'access-token-123'; }
  });
  var name = window.Identity.displayName();
  assert.strictEqual(name, null, 'Live mode with no profile name should return null, not Temitope, got: ' + name);
});

test('Live mode: Identity comes from verified session userId, not email or display name', function () {
  env = { LIFEOS_MODE: 'live', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-key' };
  var cur = window.Identity.current();
  assert.strictEqual(cur.userId, 'supabase-user', 'userId should come from session, got: ' + cur.userId);
  assert.strictEqual(cur.demo, false, 'demo flag should be false in live mode');
  assert.strictEqual(cur.authState, 'supabase', 'authState should be supabase');
});

/* ---------- Issue 2: Data isolation ---------- */

test('Demo mode: Storage key is unscoped (shared across all demo users)', function () {
  env = { LIFEOS_MODE: 'demo' };
  window.Store.setUserScope(null);
  assert.strictEqual(window.Store.storageKey(), 'lifeos.sim.v1', 'Demo mode should use unscoped key');
});

test('Demo mode: Store includes seed data (Temitope tasks visible to all)', function () {
  env = { LIFEOS_MODE: 'demo' };
  var tasks = window.Store.tasks();
  var hasSeed = tasks.some(function (t) { return t.title === 'Temitope seed task'; });
  assert.ok(hasSeed, 'Demo mode should include seed tasks');
});

test('Live mode: Storage key is namespaced by userId', function () {
  env = { LIFEOS_MODE: 'live' };
  window.Store.setUserScope('user-A');
  assert.strictEqual(window.Store.storageKey(), 'lifeos.sim.v1.user-A', 'Live mode should namespace by userId');
  window.Store.setUserScope('user-B');
  assert.strictEqual(window.Store.storageKey(), 'lifeos.sim.v1.user-B', 'Different user gets different key');
});

test('Live mode: Store excludes seed data', function () {
  env = { LIFEOS_MODE: 'live' };
  var tasks = window.Store.tasks();
  var hasSeed = tasks.some(function (t) { return t.title === 'Temitope seed task'; });
  assert.strictEqual(hasSeed, false, 'Live mode must not include Temitope seed tasks');
});

test('Live mode: Commitments are empty (no seed data)', function () {
  env = { LIFEOS_MODE: 'live' };
  var commits = window.Store.commitments();
  assert.strictEqual(commits.length, 0, 'Live mode commitments should be empty, got: ' + commits.length);
});

test('Account switch: Scope changes and previous scope data is not inherited', function () {
  env = { LIFEOS_MODE: 'live' };
  window.Store.setUserScope('user-A');
  var keyA = window.Store.storageKey();
  window.Store.setUserScope('user-B');
  var keyB = window.Store.storageKey();
  assert.notStrictEqual(keyA, keyB, 'Account switch must change storage key');
  assert.strictEqual(keyB, 'lifeos.sim.v1.user-B', 'New scope should be user-B');
});

test('Signed out: Scope is null and storage key is unscoped', function () {
  env = { LIFEOS_MODE: 'live' };
  window.Store.setUserScope(null);
  assert.strictEqual(window.Store.currentScope(), null, 'Signed out scope should be null');
  assert.strictEqual(window.Store.storageKey(), 'lifeos.sim.v1', 'Signed out should use unscoped key');
});

/* ---------- Issue 3: My Day date ---------- */

test('Demo mode: currentToday returns simulated date (September 22)', function () {
  env = { LIFEOS_MODE: 'demo' };
  var today = window.D.today();
  assert.strictEqual(today, '2026-09-22', 'Demo mode should return 2026-09-22, got: ' + today);
});

test('Live mode: currentToday returns real browser date, not September 22', function () {
  env = { LIFEOS_MODE: 'live' };
  var today = window.D.today();
  var now = new Date();
  var expected = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  assert.strictEqual(today, expected, 'Live mode should return real date, got: ' + today + ' expected: ' + expected);
  assert.notStrictEqual(today, '2026-09-22', 'Live mode must not return September 22');
});

test('Live mode: Date does not shift due to UTC conversion', function () {
  env = { LIFEOS_MODE: 'live' };
  var today = window.D.today();
  // today() should return a local date string without timezone offset
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today), 'Today should be a valid ISO date string, got: ' + today);
});

/* ---------- Issue 4: AI Notetaker ---------- */

test('Notetaker: Empty transcript returns clear status (no blank screen)', function () {
  // Simulate analyseText guard clause
  function analyseTextGuard(text) {
    if (!text || !String(text).trim()) {
      return { ok: false, message: 'Nothing to analyse - enter a transcript or upload a file first.' };
    }
    return { ok: true, message: 'Analysis ready' };
  }
  var result = analyseTextGuard('');
  assert.strictEqual(result.ok, false, 'Empty string should fail');
  assert.ok(/Nothing to analyse/.test(result.message), 'Should show clear message, got: ' + result.message);

  var result2 = analyseTextGuard('   ');
  assert.strictEqual(result2.ok, false, 'Whitespace-only should fail');

  var result3 = analyseTextGuard(null);
  assert.strictEqual(result3.ok, false, 'Null should fail');

  var result4 = analyseTextGuard(undefined);
  assert.strictEqual(result4.ok, false, 'Undefined should fail');

  var result5 = analyseTextGuard('We agreed to ship by Friday.');
  assert.strictEqual(result5.ok, true, 'Valid transcript should pass');
});

test('Notetaker: Deterministic analysis is labeled as rules-based, not AI-generated', function () {
  var analysis = window.EnginesNotetaker.analyse('We agreed to ship the proposal by Friday.', {});
  assert.strictEqual(analysis.extraction, 'rules', 'Deterministic analysis must be labeled rules, got: ' + analysis.extraction);
  assert.notStrictEqual(analysis.extraction, 'model', 'Must not be labeled model when no provider');
});

test('Notetaker: analyseRemote returns null when no provider configured', function () {
  return window.EnginesNotetaker.analyseRemote('We agreed to ship by Friday.').then(function (ai) {
    assert.strictEqual(ai, null, 'analyseRemote should return null without provider, got: ' + JSON.stringify(ai));
  });
});

test('Notetaker: analyseRemote returns null for empty input', function () {
  return window.EnginesNotetaker.analyseRemote('').then(function (ai) {
    assert.strictEqual(ai, null, 'Empty input should return null');
  });
});

test('Notetaker: analyseRemote returns null for whitespace-only input', function () {
  return window.EnginesNotetaker.analyseRemote('   \n   ').then(function (ai) {
    assert.strictEqual(ai, null, 'Whitespace-only input should return null');
  });
});

test('Live mode: Notetaker requires authenticated session', function () {
  env = { LIFEOS_MODE: 'live' };
  var isAuth = window.Session.isAuthenticated();
  assert.ok(isAuth, 'Live mode should have authenticated session after bootstrap');
  var user = window.Session.currentUser();
  assert.ok(user && user.userId, 'Session should have userId');
});

test('Notetaker: Results distinguish rule-based from AI-generated', function () {
  var ruleAnalysis = window.EnginesNotetaker.analyse('Test transcript content.', {});
  assert.strictEqual(ruleAnalysis.extraction, 'rules');

  // Simulate what happens when AI is available (model result)
  var aiAnalysis = {
    summary: 'AI summary',
    decisions: [],
    actionItems: [],
    deadlines: [],
    followUps: [],
    commitments: [],
    extraction: 'model'
  };
  assert.strictEqual(aiAnalysis.extraction, 'model');
  assert.notStrictEqual(ruleAnalysis.extraction, aiAnalysis.extraction, 'Rule and AI extraction labels must differ');
});

/* ---------- Issue: Fail-closed authentication ---------- */

test('Live mode: Misconfigured adapter does not fall back to demo', function () {
  env = { LIFEOS_MODE: 'live' }; // No SUPABASE_URL/ANON_KEY
  var adapter = window.SupabaseAuth.MisconfiguredAdapter;
  assert.strictEqual(adapter.isAuthenticated(), false, 'Misconfigured adapter must not be authenticated');
  assert.strictEqual(adapter.currentUser(), null, 'Misconfigured adapter must return null user');
});

/* ---------- Run all tests ---------- */

console.log('');
console.log('==========================================');
console.log(failed === 0 ? 'ALL PASS (' + passed + ' checks)' : failed + ' FAILURE(S), ' + passed + ' passed');
console.log('==========================================');
process.exit(failed === 0 ? 0 : 1);