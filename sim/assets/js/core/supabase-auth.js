/* ============================================================
   Supabase Auth — production authentication adapter (Stage 1A)
   ------------------------------------------------------------
   Implements the Session adapter contract against the official
   Supabase authentication client (@supabase/supabase-js, exposed
   by the host page as `window.supabase`). It is adapter #2;
   DemoAuth remains adapter #1 and stays fully functional.

   MODE SELECTION
     Demo mode (default): LIFEOS_MODE is absent or not "live".
       DemoAuth stays the active adapter. Nothing here loads,
       nothing is awaited, and the app boots synchronously.
     Production mode: LIFEOS_MODE (or LIFEOS_ENV) is "live" or
       "production". Supabase Auth becomes the active adapter,
       but ONLY when the public client config (SUPABASE_URL +
       SUPABASE_ANON_KEY) and the Supabase client are present.

    EXISTING SCHEMA (reconciled — do NOT create a competing schema)
      Stage 1A was reconciled against the existing Life OS
      production schema (supabase/migrations/). The adapter
      therefore reads ONLY objects that already exist:
        * public.profiles — columns user_id, name, email,
          timezone, subscription, preferences, created_at.
          The adapter reads name / email / timezone /
          subscription. It does NOT reference display_name or
          avatar_url (those columns do not exist).
        * The existing handle_new_user() function and the
          on_auth_user_created trigger on auth.users create the
          profile row on signup. The adapter NEVER replaces,
          duplicates or issues DDL for them.
        * public.preferences is the existing per-category
          preferences store (category / value / source /
          confidence). The adapter does NOT create a duplicate
          user_preferences table and does not read preferences at
          sign-in — mapping categories (autonomy, learned prefs)
          to the app is a later, app-layer concern.
        * No granted_permissions table is created. The Action
          Authorization Layer is client-side (core/actions.js,
          Actions.decide with the in-app user); a durable,
          DB-backed permission model is a deliberate future
          design, not part of the authentication foundation.
      Because the existing schema already provides everything the
      authentication foundation needs, NO new migration is
      required. The earlier, incorrect
      sim/supabase/migrations/001_auth_foundation.sql (which
      assumed display_name / user_preferences / granted_permissions
      and replaced the signup trigger) has been removed so it can
      never be applied by `supabase db push`.

    FAIL-CLOSED RULE (security-critical)
     Production mode never silently falls back to DemoAuth. If
     production mode is on but Supabase is not configured, or the
     client fails to load, a "misconfigured" adapter is registered
     instead: public routes (welcome/sign-in/sign-up) still open so
     the user can see the error, but every protected route is
     blocked and no session is ever established. Sign-in/sign-up
     return a clear failure. The demo is NOT activated.

   SESSION SECURITY — where things live (browser build)
     * The client-side Supabase session is maintained by supabase-js
       in the browser's localStorage, under its own key
       ("sb-<project-ref>-auth-token"). This adapter does NOT read or
       write that key directly; it asks the client via getSession() /
       getUser() and keeps an in-memory cache hydrated at boot and
       kept in sync via onAuthStateChange().
     * Credential/token material accessible to browser JavaScript:
       the short-lived access token (a JWT) and the refresh token,
       because supabase-js persists them in localStorage. Any
       same-origin script (and any XSS) can read them. The access
       token is what supabase-js sends to Supabase APIs.
     * What is protected by Supabase: Row Level Security on every
       table uses the access token's "sub" claim (= auth.uid()). The
       token is verified by Supabase's server, never by browser code
       here. This adapter performs no JWT parsing or validation.
     * What remains server-side only: the service-role key, the
       database password, the connection string, OAuth client secrets
       and any third-party API keys. None of these are ever sent to
       the browser (see core/oauth.js SERVER_SECRET_KEYS).
     * If Life OS later introduces a server / SSR architecture, the
       session should move to a server-managed httpOnly, Secure,
       SameSite cookie; the browser would no longer hold the refresh
       token, and supabase-js would be configured with a custom
       storage adapter (or @supabase/ssr) that round-trips through
       the backend. This browser-only build does NOT use httpOnly
       cookies and must not be described as doing so.

   The official client is provided by the host page (a <script> tag
   for the UMD build) or auto-loaded from a configurable, non-secret
   URL (SUPABASE_CLIENT_URL). No credentials are ever hard-coded.
   ============================================================ */
(function () {
  'use strict';

  /* Same public routes as DemoAuth — the OAuth callback stays public
     so the (structure-only) Google return route always works. */
  var PUBLIC = {
    '/welcome': true, '/signin': true, '/signup': true, '/oauth': true
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MIN_PASSWORD_LENGTH = 8;

  var PENDING = null; /* cached bootstrap promise (idempotent) */

  /* ---------- Configuration / mode detection ---------- */
  function mode() {
    var m = (window.Config && (window.Config.get('LIFEOS_MODE') || window.Config.get('LIFEOS_ENV'))) || '';
    return String(m || 'demo').toLowerCase();
  }
  function isProductionMode() {
    var m = mode();
    return m === 'live' || m === 'production';
  }
  /* Only the PUBLIC, non-secret client configuration. The anon key is
     public by design (Supabase RLS protects data); the service-role key
     is NEVER requested here. */
  function isConfigured() {
    return !!(window.Config && window.Config.get('SUPABASE_URL') && window.Config.get('SUPABASE_ANON_KEY'));
  }
  function clientAvailable() {
    return !!(window.supabase && typeof window.supabase.createClient === 'function');
  }
  /* Optional, non-secret URL of the Supabase client bundle. When set and
     the client is not yet present, bootstrap() loads it before proceeding. */
  function clientUrl() {
    return window.Config ? window.Config.get('SUPABASE_CLIENT_URL') : null;
  }
  function isPublic(path) { return !!PUBLIC[path]; }

  function nameFromEmail(email) {
    var local = ((email || '').split('@')[0] || '').trim();
    var parts = local.split(/[._\-+]+/).filter(Boolean);
    if (!parts.length) return null;
    return parts.map(function (p) {
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    }).join(' ');
  }

  /* Map a Supabase error to a user-safe message. Never surfaces raw
     provider responses or anything that could carry a secret. */
  function authErrorMessage(err) {
    var raw = (err && (err.message || err.error_description || err.error)) || '';
    var m = String(raw).toLowerCase();
    if (m.indexOf('invalid login') !== -1 || m.indexOf('invalid email') !== -1) return 'Invalid email or password.';
    if (m.indexOf('already registered') !== -1 || m.indexOf('user already') !== -1) return 'An account with this email already exists.';
    if (m.indexOf('not confirmed') !== -1 || m.indexOf('confirm') !== -1) return 'Please confirm your email address before signing in.';
    if (m.indexOf('password') !== -1 && m.indexOf('weak') !== -1) return 'Password is too weak.';
    if (m.indexOf('rate') !== -1 || m.indexOf('too many') !== -1) return 'Too many attempts. Please wait and try again.';
    if (m.indexOf('network') !== -1 || m.indexOf('fetch') !== -1) return 'Network error. Please check your connection and try again.';
    return 'Could not complete the request. Please try again.';
  }
  function misconfigMessage() {
    return 'Production authentication is not configured. This deployment is locked and does not fall back to demo mode.';
  }

  /* ---------- Fail-closed adapter ----------
     Registered when production mode is on but Supabase is unusable.
     Public routes stay open (so the sign-in screen and its error are
     reachable); every protected route is blocked; no session exists. */
  var MisconfiguredAdapter = {
    id: 'misconfigured',
    misconfigured: true,
    session:         function () { return null; },
    isAuthenticated: function () { return false; },
    currentUser:     function () { return null; },
    requireAuth:     function (path) { return isPublic(path); },
    signOut:         function () {},
    storageKey:      function () { return null; },
    signIn:          function () { return Promise.resolve({ ok: false, errors: [misconfigMessage()] }); },
    signUp:          function () { return Promise.resolve({ ok: false, errors: [misconfigMessage()] }); },
    restore:         function () { return Promise.resolve(); }
  };

  /* ---------- Supabase adapter ---------- */
  function create(client, opts) {
    opts = opts || {};
    var cache = { session: null, user: null, profile: null, ready: false };
    var onChange = opts.onChange || null;
    var subscription = null;

    function clearCache() {
      cache.session = null; cache.user = null; cache.profile = null;
      cache.ready = false;
    }
    function notify() { if (typeof onChange === 'function') onChange(); }

    /* Normalize a Supabase session into the app-facing session shape.
       The raw access/refresh tokens stay inside the adapter (held by the
       Supabase client) and are deliberately NOT spread into app objects. */
    function normalizeSession(s) {
      if (!s) return null;
      return {
        demo: false,
        userId: (s.user && s.user.id) || null,
        expiresAt: s.expires_at || null,
        createdAt: s.created_at || null
      };
    }

    /* Merge the Supabase auth user with the user's EXISTING
       public.profiles row. Only columns that already exist in the
       production schema are read: name, email, timezone,
       subscription. No display_name / avatar_url (they do not
       exist), and no user_preferences / granted_permissions (they
       do not exist). */
    function normalizeUser(user, s, profile) {
      var meta = user.user_metadata || {};
      var email = user.email || meta.email || null;
      var name = (profile && profile.name) || meta.full_name || meta.name || null;
      return {
        demo: false,
        userId: user.id || null,
        name: name || nameFromEmail(email) || 'User',
        email: email,
        authState: 'supabase',
        signedInAt: (s && (s.created_at || s.expires_at)) || user.created_at || null,
        /* Existing profile columns. */
        timezone: (profile && profile.timezone) || undefined,
        subscription: (profile && profile.subscription) || undefined,
        /* The following are NOT columns in the production schema.
           role is a controlled authorization field (introduced later
           with the authorization model, never a user-editable
           preference). autonomy, permissions and learnedPrefs are
           app-layer facts: in demo they come from the in-app Store;
           in production they will be backed by public.preferences and
           a future permission model. They are intentionally left
           undefined here so that no fact is fabricated from the auth
           session. */
        role: undefined,
        autonomy: undefined,
        permissions: undefined,
        learnedPrefs: undefined
      };
    }

    /* Read the user's existing public.profiles row (SELECT policy:
       user_id = auth.uid()). This is the ONLY database read the
       adapter performs at sign-in — the existing schema already
       holds every identity fact the authentication foundation needs. */
    function fetchProfile(userId) {
      return client.from('profiles').select('*').eq('user_id', userId).single()
        .then(function (r) { return (r && r.data) || null; })
        .catch(function () { return null; });
    }

    function subscribe() {
      if (subscription || !client.auth.onAuthStateChange) return;
      try {
        var sub = client.auth.onAuthStateChange(function (event, s) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            refreshFromSession(s).then(notify);
          } else if (event === 'SIGNED_OUT') {
            clearCache(); notify();
          }
        });
        subscription = sub && sub.data && sub.data.subscription;
      } catch (e) { /* older client versions */ }
    }

    /* Hydrate the cache from a Supabase session: resolve the user, then
       read the user's EXISTING public.profiles row (the only database
       read the authentication foundation needs). */
    function refreshFromSession(s) {
      var getUser = (client.auth.getUser)
        ? client.auth.getUser()
        : Promise.resolve({ data: { user: (s && s.user) || null } });
      return getUser.then(function (ur) {
        var user = (ur && ur.data && ur.data.user) || (s && s.user) || null;
        if (!user) { clearCache(); return; }
        cache.session = normalizeSession(s);
        var userId = user.id;
        return fetchProfile(userId).then(function (profile) {
          cache.profile = profile;
          cache.user = normalizeUser(user, s, profile);
          cache.ready = true;
          subscribe();
          notify();
        });
      }).catch(function () { clearCache(); });
    }

    /* ---------- Session adapter contract ---------- */
    function session()         { return cache.session; }
    function isAuthenticated() { return !!cache.session && !!cache.user; }
    function currentUser()     { return cache.user; }
    function requireAuth(path) { return isPublic(path) || isAuthenticated(); }
    function storageKey() {
      /* Diagnostic only — supabase-js owns the real storage key
         ("sb-<project-ref>-auth-token"); this adapter never touches it. */
      try {
        var url = new URL(window.Config.get('SUPABASE_URL'));
        return 'sb-' + url.hostname.split('.')[0] + '-auth-token';
      } catch (e) { return 'supabase'; }
    }

    function restore() {
      return client.auth.getSession()
        .then(function (r) {
          var s = r && r.data && r.data.session;
          if (!s) { clearCache(); return; }
          return refreshFromSession(s);
        })
        .catch(function () { clearCache(); });
    }

    function signIn(fields) {
      var email = ((fields && fields.email) || '').trim();
      var password = (fields && fields.password) || '';
      if (!email || !password) {
        return Promise.resolve({ ok: false, errors: ['Email address and password are required.'] });
      }
      return client.auth.signInWithPassword({ email: email, password: password })
        .then(function (r) {
          var err = r && r.error;
          if (err) return { ok: false, errors: [authErrorMessage(err)] };
          var s = r && r.data && r.data.session;
          return refreshFromSession(s).then(function () {
            return { ok: true, session: cache.session, user: cache.user };
          });
        })
        .catch(function (e) { return { ok: false, errors: [authErrorMessage(e)] }; });
    }

    function signUp(fields) {
      var name = ((fields && fields.name) || '').trim();
      var email = ((fields && fields.email) || '').trim();
      var password = (fields && fields.password) || '';
      var confirm = (fields && fields.confirm) || '';
      /* Client-side validation only. The password is sent to Supabase over
         TLS and hashed server-side; it is never stored, logged or compared
         by this adapter. */
      var errors = [];
      if (!name) errors.push('Full name is required.');
      if (!email) errors.push('Email address is required.');
      else if (!EMAIL_RE.test(email)) errors.push('Enter a valid email address.');
      if (!password) errors.push('Password is required.');
      else if (password.length < MIN_PASSWORD_LENGTH) errors.push('Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.');
      if (!confirm) errors.push('Please confirm your password.');
      else if (password && confirm && password !== confirm) errors.push('Passwords do not match.');
      if (errors.length) return Promise.resolve({ ok: false, errors: errors });

      return client.auth.signUp({ email: email, password: password, options: { data: { full_name: name } } })
        .then(function (r) {
          var err = r && r.error;
          if (err) return { ok: false, errors: [authErrorMessage(err)] };
          var s = r && r.data && r.data.session;
          var u = r && r.data && r.data.user;
          if (s) {
            return refreshFromSession(s).then(function () {
              return { ok: true, session: cache.session, user: cache.user };
            });
          }
          /* Supabase may require email confirmation before a session is
             issued. The account may exist but is not yet signed in. */
          return { ok: true, session: null, user: u, needsConfirmation: true };
        })
        .catch(function (e) { return { ok: false, errors: [authErrorMessage(e)] }; });
    }

    function signOut() {
      return client.auth.signOut()
        .then(function () { clearCache(); notify(); })
        .catch(function () { clearCache(); notify(); });
    }

    function setOnChange(fn) { onChange = fn; }

    return {
      id: 'supabase',
      session: session,
      isAuthenticated: isAuthenticated,
      currentUser: currentUser,
      requireAuth: requireAuth,
      signOut: signOut,
      storageKey: storageKey,
      signIn: signIn,
      signUp: signUp,
      restore: restore,
      setOnChange: setOnChange
    };
  }

  /* ---------- Client loading ---------- */
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Supabase client failed to load')); };
      document.head.appendChild(s);
    });
  }

  function ensureClient() {
    if (clientAvailable()) {
      return Promise.resolve(window.supabase.createClient(window.Config.get('SUPABASE_URL'), window.Config.get('SUPABASE_ANON_KEY')));
    }
    var url = clientUrl();
    if (!url) return Promise.resolve(null); /* no client and no URL → misconfigured */
    return loadScript(url)
      .then(function () {
        if (!clientAvailable()) return null;
        return window.supabase.createClient(window.Config.get('SUPABASE_URL'), window.Config.get('SUPABASE_ANON_KEY'));
      })
      .catch(function () { return null; });
  }

  /* ---------- Bootstrap / adapter selection ----------
     Returns false in demo mode (synchronous no-op — DemoAuth, registered
     by session.js, stays active). Returns a Promise in production mode. */
  function bootstrap() {
    if (!isProductionMode()) return false;
    if (PENDING) return PENDING;
    PENDING = bootstrapProduction().then(function (result) {
      return result;
    }, function () {
      /* bootstrapProduction registers a fail-closed adapter on error. */
      return true;
    });
    return PENDING;
  }

  function bootstrapProduction() {
    /* Production mode is explicitly on. NEVER fall back to DemoAuth. */
    if (!isConfigured()) {
      window.Session.setAdapter(MisconfiguredAdapter);
      return Promise.resolve({ mode: 'production', status: 'misconfigured', adapter: MisconfiguredAdapter });
    }
    return ensureClient().then(function (client) {
      if (!client) {
        window.Session.setAdapter(MisconfiguredAdapter);
        return { mode: 'production', status: 'misconfigured', adapter: MisconfiguredAdapter };
      }
      var adapter = create(client, {
        onChange: function () { if (window.App && typeof window.App.render === 'function') window.App.render(); }
      });
      return adapter.restore().then(function () {
        window.Session.setAdapter(adapter);
        return { mode: 'production', status: 'ready', adapter: adapter };
      });
    });
  }

  window.SupabaseAuth = {
    mode: mode,
    isProductionMode: isProductionMode,
    isConfigured: isConfigured,
    clientAvailable: clientAvailable,
    bootstrap: bootstrap,
    SupabaseAuthAdapter: { create: create },
    MisconfiguredAdapter: MisconfiguredAdapter,
    loadScript: loadScript
  };
})();
