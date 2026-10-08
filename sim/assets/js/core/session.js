/* ============================================================
   Session — provider-neutral authentication session
   ------------------------------------------------------------
   A thin, stable interface between the rest of the app and
   whichever authentication adapter is registered. Today the
   adapter is the assessment-safe DemoAuth; a real provider
   (for example Supabase Auth) can be swapped in later by
   registering a different adapter, with no change to the
   app, the views or the routes.

   Session owns no authentication logic and persists nothing
   itself — the registered adapter is the source of truth for
   how sessions are created, read and cleared. Every method
   simply delegates to the adapter, so the app depends on
   this one interface instead of a specific provider.

    Adapter contract:
      session()          -> signed-in session object, or null
      isAuthenticated()  -> true when a session exists
      currentUser()      -> { userId, name, email, ... } or null
      requireAuth(path)  -> true when the path may be opened
      signOut()          -> end the current session
      storageKey()       -> the adapter's storage key (diagnostics)
      signIn(fields)     -> authenticate (sync or Promise)
      signUp(fields)     -> create an account (sync or Promise)
      restore()          -> re-hydrate the session (Promise, optional)
   ============================================================ */
(function () {
  'use strict';

  var adapter = null;

  function setAdapter(a) { adapter = a; }
  function getAdapter() { return adapter; }

  /* Fail closed: with no adapter nothing is authenticated
     and nothing is required-authenticated. In practice the
     demo adapter is registered below as soon as this file
     loads, so the adapter is always present. */
  function session()         { return adapter ? adapter.session() : null; }
  function isAuthenticated() { return adapter ? !!adapter.isAuthenticated() : false; }
  function currentUser()     { return adapter ? adapter.currentUser() : null; }
  function requireAuth(path) { return adapter ? !!adapter.requireAuth(path) : false; }
  function signOut()         { if (adapter) adapter.signOut(); }
  function storageKey()      { return adapter ? adapter.storageKey() : null; }
  /* signIn / signUp / restore are optional on the adapter. A
     synchronous adapter (DemoAuth) returns its result directly;
     an asynchronous adapter (Supabase) returns a Promise. */
  function signIn(fields) {
    return (adapter && typeof adapter.signIn === 'function')
      ? adapter.signIn(fields)
      : { ok: false, errors: ['No authentication adapter available.'] };
  }
  function signUp(fields) {
    return (adapter && typeof adapter.signUp === 'function')
      ? adapter.signUp(fields)
      : { ok: false, errors: ['No authentication adapter available.'] };
  }
  function restore() {
    return (adapter && typeof adapter.restore === 'function')
      ? adapter.restore()
      : undefined;
  }

  window.Session = {
    setAdapter: setAdapter,
    getAdapter: getAdapter,
    session: session,
    isAuthenticated: isAuthenticated,
    isSignedIn: isAuthenticated,   /* DemoAuth-compatible alias */
    currentUser: currentUser,
    requireAuth: requireAuth,
    signOut: signOut,
    storageKey: storageKey,
    signIn: signIn,
    signUp: signUp,
    restore: restore
  };

  /* Adapter #1 — the existing DemoAuth. It translates the
     DemoAuth API onto the Session interface, so nothing else
     in the app needs to know about DemoAuth. */
  var DemoAuthAdapter = {
    id: 'demo',
    session:         function () { return window.DemoAuth.session(); },
    isAuthenticated: function () { return window.DemoAuth.isSignedIn(); },
    currentUser:     function () { return window.DemoAuth.session(); },
    requireAuth:     function (path) { return window.DemoAuth.requireAuth(path); },
    signOut:         function () { window.DemoAuth.signOut(); },
    storageKey:      function () { return window.DemoAuth.KEY; },
    signIn:          function (fields) { return window.DemoAuth.signIn(fields); },
    signUp:          function (fields) { return window.DemoAuth.signUp(fields); }
  };

  window.Session.setAdapter(DemoAuthAdapter);
})();
