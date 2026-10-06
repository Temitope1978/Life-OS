/* ============================================================
   Demo authentication — assessment-safe demo session
   ------------------------------------------------------------
   This is NOT real authentication. It is a clearly-labelled
   demo sign-in / sign-up experience for demonstrating the
   product to an assessor. Supabase Auth is NOT activated and
   no production authentication backend exists.

   SECURITY MODEL
     * No password is ever stored, logged, returned, written to
       the DOM, placed in a URL, or saved in a JavaScript file.
     * A password is validated in memory only, for the duration
       of the current sign-up / sign-in interaction, then
       discarded. Nothing is compared against a stored value
       because nothing is stored.
     * The only persisted state is a non-sensitive demo session
       under the explicitly-named key `lifeos_demo_session`:
         { demo, userId, name, email, authState, signedInAt }
       It is deliberately NOT named like a production token and
       holds no password, no token and no secret.

   The demo session is a SEPARATE concern from the existing
   `lifeos.sim.v1` mutable layer: it does not touch the seed,
   the engines, the providers, OAuth or the Action Authorization
   Layer.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'lifeos_demo_session';
  var MIN_PASSWORD_LENGTH = 8;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.demo === true) ? s : null;
    } catch (e) { return null; } /* corrupt storage — treat as signed out */
  }

  function write(session) {
    try { window.localStorage.setItem(KEY, JSON.stringify(session)); }
    catch (e) { /* private mode / quota — demo continues without persistence */ }
  }

  function session() { return read(); }
  function isSignedIn() { return !!read(); }

  /* Derive a display name from an email local part:
     "alex.morgan@x.com" -> "Alex Morgan". Used by sign-in, which
     has no stored profile to restore (no profile is persisted). */
  function nameFromEmail(email) {
    var local = ((email || '').split('@')[0] || 'Demo').trim();
    var parts = local.split(/[._\-+]+/).filter(Boolean);
    if (!parts.length) parts = ['Demo'];
    return parts.map(function (p) {
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    }).join(' ');
  }

  function uid() {
    return 'demo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* Validate sign-up fields. Returns { ok, errors[] }.
     The password is checked in memory only and never returned. */
  function validateSignUp(fields) {
    var errors = [];
    var name = (fields.name || '').trim();
    var email = (fields.email || '').trim();
    var password = fields.password || '';
    var confirm = fields.confirm || '';

    if (!name) errors.push('Full name is required.');
    if (!email) errors.push('Email address is required.');
    else if (!EMAIL_RE.test(email)) errors.push('Enter a valid email address.');
    if (!password) errors.push('Password is required.');
    else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.push('Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.');
    }
    if (!confirm) errors.push('Please confirm your password.');
    else if (password && confirm && password !== confirm) errors.push('Passwords do not match.');

    return { ok: errors.length === 0, errors: errors };
  }

  function validateSignIn(fields) {
    var errors = [];
    var email = (fields.email || '').trim();
    var password = fields.password || '';

    if (!email) errors.push('Email address is required.');
    else if (!EMAIL_RE.test(email)) errors.push('Enter a valid email address.');
    if (!password) errors.push('Password is required.');
    else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.push('Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.');
    }

    return { ok: errors.length === 0, errors: errors };
  }

  /* Create a demo session from a sign-up. The password is NEVER stored. */
  function signUp(fields) {
    var v = validateSignUp(fields);
    if (!v.ok) return { ok: false, errors: v.errors };
    var s = {
      demo: true,
      userId: uid(),
      name: (fields.name || '').trim(),
      email: (fields.email || '').trim(),
      authState: 'demo',
      signedInAt: new Date().toISOString()
    };
    write(s);
    return { ok: true, session: s };
  }

  /* Create a demo session from a sign-in. The password is validated
     in memory and discarded; it is never stored or compared. */
  function signIn(fields) {
    var v = validateSignIn(fields);
    if (!v.ok) return { ok: false, errors: v.errors };
    var email = (fields.email || '').trim();
    var s = {
      demo: true,
      userId: uid(),
      name: nameFromEmail(email),
      email: email,
      authState: 'demo',
      signedInAt: new Date().toISOString()
    };
    write(s);
    return { ok: true, session: s };
  }

  /* One-click demo session. Involves NO password at all, so no
     password is ever written into a JavaScript file. */
  function continueDemo() {
    var s = {
      demo: true,
      userId: uid(),
      name: 'Demo User',
      email: 'demo@lifeos.local',
      authState: 'demo',
      signedInAt: new Date().toISOString()
    };
    write(s);
    return { ok: true, session: s };
  }

  function signOut() {
    try { window.localStorage.removeItem(KEY); } catch (e) {}
  }
  function clear() { signOut(); }

  /* Public routes need no demo session. The OAuth callback stays
     public so the (structure-only) Google return route always works. */
  var PUBLIC = {
    '/welcome': true, '/signin': true, '/signup': true, '/oauth': true
  };

  function isPublic(path) { return !!PUBLIC[path]; }

  /* True when the path may be opened: it is public, or a demo
     session exists. The caller redirects to #/signin otherwise. */
  function requireAuth(path) {
    return isPublic(path) || isSignedIn();
  }

  window.DemoAuth = {
    KEY: KEY,
    MIN_PASSWORD_LENGTH: MIN_PASSWORD_LENGTH,
    session: session,
    isSignedIn: isSignedIn,
    isPublic: isPublic,
    requireAuth: requireAuth,
    validateSignUp: validateSignUp,
    validateSignIn: validateSignIn,
    signUp: signUp,
    signIn: signIn,
    continueDemo: continueDemo,
    signOut: signOut,
    clear: clear,
    nameFromEmail: nameFromEmail
  };
})();
