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

  /* True when the Supabase production adapter (or its fail-closed
     placeholder) is active. Shared so every view applies the same
     demo/production display rules. */
  function productionMode() {
    if (window.SupabaseAuth && typeof window.SupabaseAuth.isProductionMode === 'function') {
      try { return !!window.SupabaseAuth.isProductionMode(); } catch (e) { return false; }
    }
    var a = (window.Session && window.Session.getAdapter) ? window.Session.getAdapter() : null;
    return !!(a && (a.id === 'supabase' || a.id === 'misconfigured'));
  }

  /* The signed-in account's own display name, or null when nobody is
     signed in. NEVER the demo seed profile: in production the seed
     name belongs to nobody, and showing it would display one
     person's name to another account. Demo branding is preserved
     because the DemoAuth session itself carries the demo name. */
  function displayName() {
    var id = current();
    return (id && id.userId && id.name) ? id.name : null;
  }

  /* The signed-in account's own email, or null when signed out. */
  function displayEmail() {
    var id = current();
    return (id && id.userId && id.email) ? id.email : null;
  }

  /* First name for greetings ("Hello, Temitope."): the first word of
     the signed-in account's display name, or null when signed out.
     Never derived from anyone else's identity — displayName() above
     is already the account's own (or null). */
  function firstName() {
    var n = displayName();
    if (!n) return null;
    var first = String(n).split(/\s+/).filter(Boolean)[0];
    return first || null;
  }

  /* The signed-in account's timezone, or null when signed out or
     when the profile carries none (timezone is optional in the
     production schema). Callers fall back to the demo default. */
  function displayTimezone() {
    var id = current();
    return (id && id.userId && id.timezone) ? id.timezone : null;
  }

  window.Identity = { current: current, productionMode: productionMode, displayName: displayName, displayEmail: displayEmail, displayTimezone: displayTimezone, firstName: firstName };
})();
