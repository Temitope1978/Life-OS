/* ============================================================
   Identity — the signed-in user, as the rest of the app sees it
   ------------------------------------------------------------
   A read-only view of "who is using Life OS right now". It
   combines two sources into one object:

       1. the authentication session — Session.currentUser()
          — which supplies the identity facts: userId, name,
          email, authState, and (in production) the user's
          profile facts read from the EXISTING public.profiles
          row (name, email, timezone, subscription).
       2. the in-app profile — Store.user() — which supplies
          the profile facts in DEMO mode: role, timezone,
          autonomy, permissions and learned preferences.

   In DEMO mode the DemoAuth session carries no profile facts,
   so they are read from Store. In PRODUCTION mode the
   Supabase adapter supplies the identity facts from the user's
   own public.profiles row; Identity deliberately does NOT fall
   back to the demo seed profile for a real signed-in user.

   The production schema has no role / autonomy / permissions /
   learnedPrefs columns. Those are app-layer facts (demo Store
   now; public.preferences and a future permission model
   later), so they are left undefined in production rather than
   fabricated from the auth session.

   Identity never authenticates, never persists and never
   mutates anything. It simply merges the two sources so a
   view (Settings, the header, the Command Center) can read
   one object instead of reaching into the auth adapter and
   the store separately. When a real provider replaces
   DemoAuth, only the adapter changes — Identity and every
   view that reads it stay exactly the same.
   ============================================================ */
(function () {
  'use strict';

  function current() {
    var session = (window.Session && window.Session.currentUser)
      ? window.Session.currentUser()
      : null;
    var adapter = (window.Session && window.Session.getAdapter)
      ? window.Session.getAdapter()
      : null;
    /* True when the Supabase production adapter is active. */
    var production = !!(adapter && adapter.id === 'supabase');
    var profile = (window.Store && window.Store.user)
      ? window.Store.user()
      : {};

    var signedIn = !!session;

    /* Profile facts. In production they come from the
       authenticated user's own records (via the adapter);
       in demo they come from the in-app store. */
    function fact(key) {
      if (production) {
        return (signedIn && session[key] !== undefined) ? session[key] : undefined;
      }
      return profile[key];
    }

    return {
      /* Identity facts — from the authentication session. */
      userId:     signedIn ? session.userId : null,
      name:       signedIn ? session.name : (production ? undefined : profile.name),
      email:      signedIn ? session.email : (production ? undefined : profile.email),
      authState:  signedIn ? session.authState : null,
      signedInAt: signedIn ? session.signedInAt : null,
      demo:       signedIn ? !!session.demo : false,

      /* Profile facts — production records, or the demo store. */
      role:         fact('role'),
      timezone:     fact('timezone'),
      subscription: fact('subscription'),
      autonomy:     fact('autonomy'),
      permissions:  fact('permissions'),
      learnedPrefs: fact('learnedPrefs')
    };
  }

  window.Identity = { current: current };
})();
