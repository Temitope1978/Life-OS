/* ============================================================
   GOOGLE OAUTH — Gmail + Google Calendar  (preparation only)
   ------------------------------------------------------------
   ONE coherent Google authorization architecture covering both
   Google services, with explicit, granular scopes. This is the
   STRUCTURE for live OAuth — not a live connection. No real
   Google credentials are created, required, or stored here.

   SECURITY BOUNDARY (critical)
   ----------------------------
   Browser-safe, NON-SECRET configuration — may be injected into
   window.__LIFEOS_ENV__ and read by this module:
       GOOGLE_CLIENT_ID     public, non-secret
       GOOGLE_REDIRECT_URI  public, non-secret
       GOOGLE_SERVICES      non-secret, e.g. "gmail,calendar"
       LIFEOS_MODE          non-secret, "demo" | "live"

   SERVER-SIDE SECRETS — NEVER in the browser (never in window,
   frontend JS, HTML, localStorage, sessionStorage, or any
   client-accessible configuration):
       GOOGLE_CLIENT_SECRET
       GOOGLE_ACCESS_TOKEN
       GOOGLE_REFRESH_TOKEN
       OPENAI_API_KEY
       SUPABASE_SERVICE_ROLE_KEY
       SUPABASE_DB_URL
       SUPABASE_DB_PASSWORD

   The browser NEVER performs the OAuth token exchange. It builds
   the authorization URL from non-secret config, sends the user to
   Google's consent screen, and hands the returned authorization
   code to a controlled backend endpoint, which exchanges it using
   the server-side Client Secret and stores the tokens server-side.
   The browser receives only a non-secret confirmation of the
   connection state.

   The redirect URI is NEVER guessed. It is a configurable,
   non-secret value that must be registered in Google Cloud Console
   and must point to the hosted deployment's OAuth callback. The
   app-internal callback ROUTE is #/oauth/google/callback, which
   follows the app's existing hash-routing convention (#/path/params).
   ============================================================ */
(function () {
  'use strict';

  var F = (window.Providers && window.Providers.FAILURE) || {};

  /* Google OAuth 2.0 endpoints. */
  var AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
  var TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'; // server-side only

  /* The app-internal callback route. Determined by inspecting the
     app's hash router (#/path/params) in core/app.js. This is NOT
     the external redirect URI — it is the route the app uses to
     handle Google's response once the (configurable, hosted)
     redirect URI routes back to the application. */
  var CALLBACK_ROUTE = '#/oauth/google/callback';

  /* ---------- Granular scopes ----------
     Each service exposes explicit access levels. The app requests
     only the levels it needs for a given flow — never broad
     permissions by default. Sending and calendar-write are
     separate, sensitive scopes that are NOT requested for the
     first live test. */
  var SERVICES = {
    gmail: {
      name: 'Gmail',
      providerId: 'gmail',
      scopes: {
        read:  { scope: 'https://www.googleapis.com/auth/gmail.readonly', label: 'Read email (intelligence only)' },
        draft: { scope: 'https://www.googleapis.com/auth/gmail.modify',  label: 'Create and edit drafts (never sends)' },
        send:  { scope: 'https://www.googleapis.com/auth/gmail.send',    label: 'Send email (sensitive — opt-in only)' }
      }
    },
    calendar: {
      name: 'Google Calendar',
      providerId: 'google_calendar',
      scopes: {
        read:        { scope: 'https://www.googleapis.com/auth/calendar.readonly',        label: 'Read calendar' },
        eventsRead:  { scope: 'https://www.googleapis.com/auth/calendar.events.readonly', label: 'Read calendar events (narrower)' },
        eventsWrite: { scope: 'https://www.googleapis.com/auth/calendar.events',          label: 'Create and modify calendar events' }
      }
    }
  };

  /* Minimum access levels for the FIRST live test: read-only
     intelligence across both services. No draft, send, or write. */
  var FIRST_LIVE_TEST_LEVELS = { gmail: ['read'], calendar: ['read'] };

  /* Server-side secret keys. Their VALUES must never be read into
     the browser; this list exists only so the browser can audit
     that none of them are present. */
  var SERVER_SECRET_KEYS = [
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_ACCESS_TOKEN',
    'GOOGLE_REFRESH_TOKEN',
    'OPENAI_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL',
    'SUPABASE_DB_PASSWORD'
  ];

  /* In-memory CSRF state for the current authorization request.
     Deliberately NOT persisted to localStorage/sessionStorage; in
     production the state is verified server-side (or via a secure
     httpOnly cookie), never in browser storage. */
  var pendingState = null;

  /* Server-reported authorization state. In production the backend
     pushes the authoritative state to the browser over a non-secret
     channel. Null in the demo, so the state is derived from config. */
  var serverAuthState = null;

  /* ---------- Non-secret configuration ---------- */
  function configuredServices() {
    var raw = (window.Config && (window.Config.get('GOOGLE_SERVICES'))) || '';
    var list;
    if (Array.isArray(raw)) list = raw;
    else list = String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    /* Default to both Google services when the setting is absent. */
    return list.length ? list : ['gmail', 'calendar'];
  }

  function mode() {
    var m = (window.Config && (window.Config.get('LIFEOS_MODE') || window.Config.get('LIFEOS_ENV'))) || '';
    return String(m || 'demo').toLowerCase();
  }

  function validRedirectUri(uri) {
    /* A real redirect URI is an absolute http(s) URL. An arbitrary
       string is not a valid redirect URI and is never accepted. */
    return typeof uri === 'string' && /^https?:\/\//.test(uri);
  }

  function isConfigured() {
    var redirectUri = window.Config ? window.Config.get('GOOGLE_REDIRECT_URI') : null;
    return !!(window.Config && window.Config.get('GOOGLE_CLIENT_ID') && validRedirectUri(redirectUri));
  }

  /* ---------- Scopes ---------- */
  function scopesFor(service, levels) {
    var svc = SERVICES[service];
    if (!svc) return [];
    var want = levels || ['read'];
    var out = [];
    want.forEach(function (lv) {
      if (svc.scopes[lv]) out.push(svc.scopes[lv].scope);
    });
    return out;
  }

  function firstLiveTestScopes() {
    var out = [];
    Object.keys(FIRST_LIVE_TEST_LEVELS).forEach(function (svc) {
      out = out.concat(scopesFor(svc, FIRST_LIVE_TEST_LEVELS[svc]));
    });
    return out;
  }

  /* ---------- Authorization URL ----------
     Returns null unless BOTH the Client ID and the redirect URI
     are configured. The redirect URI is never invented. */
  function authorizationUrl(opts) {
    opts = opts || {};
    var clientId = window.Config ? window.Config.get('GOOGLE_CLIENT_ID') : null;
    var redirectUri = window.Config ? window.Config.get('GOOGLE_REDIRECT_URI') : null;
    if (!clientId || !validRedirectUri(redirectUri)) return null;

    var services = opts.services || configuredServices();
    var levels = opts.levels || FIRST_LIVE_TEST_LEVELS;
    var scopes = [];
    services.forEach(function (svc) {
      scopes = scopes.concat(scopesFor(svc, levels[svc]));
    });
    if (!scopes.length) return null;

    pendingState = opts.state || randomState();
    var params = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state: pendingState,
      access_type: opts.offline ? 'offline' : 'online',
      include_granted_scopes: 'true'
    };
    if (opts.offline) params.prompt = 'consent';

    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return AUTH_ENDPOINT + '?' + qs;
  }

  function randomState() {
    return 'lifeos-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 10);
  }

  /* ---------- Authorization state ---------- */
  /* The backend may push the authoritative state (production). */
  function setAuthState(state) { serverAuthState = state || null; }

  function authState(service) {
    if (serverAuthState) return serverAuthState;
    if (!isConfigured()) return F.NOT_CONFIGURED || 'not_configured';
    /* Configured (non-secret values present) but not yet authorized:
       the user has not completed Google sign-in, so a server-side
       token does not exist. */
    return F.AUTH_REQUIRED || 'auth_required';
  }

  /* ---------- Callback handling ----------
     Parses Google's response. NEVER stores the code, the state, or
     any token. The code is acknowledged, not retained. */
  function handleCallback(service, queryString) {
    var q = parseQuery(queryString || '');
    if (q.error) {
      return {
        ok: false, service: service || 'google', error: q.error,
        message: safeOAuthError(q.error),
        detail: 'The connection was not completed. No code or token was stored.'
      };
    }
    if (q.code) {
      return {
        ok: true, service: service || 'google', hasCode: true,
        message: 'Authorization code received.',
        detail: 'The code is sent to the server, which exchanges it with the ' +
                'server-side Client Secret. Access and refresh tokens are stored ' +
                'server-side only and never reach the browser.'
      };
    }
    return {
      ok: false, service: service || 'google', hasCode: false,
      message: 'No authorization code in the URL.',
      detail: 'Start the connection from the Control screen. Google redirects ' +
              'back here with a code after you approve the requested scopes.'
    };
  }

  function parseQuery(qs) {
    var out = {};
    if (!qs) return out;
    var s = String(qs).replace(/^\?/, '');
    s.split('&').forEach(function (pair) {
      if (!pair) return;
      var kv = pair.split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      if (k) out[k] = v;
    });
    return out;
  }

  /* The token exchange is a SERVER-ONLY operation. The browser never
     sees the Client Secret, the access token, or the refresh token. */
  function exchangeCodeServerSide() {
    return {
      ok: false,
      serverOnly: true,
      endpoint: TOKEN_ENDPOINT,
      message: 'Token exchange is a server-only operation.',
      detail: 'A backend endpoint (for example /api/oauth/google/token) performs ' +
              'the exchange using the server-side Client Secret and stores the ' +
              'tokens server-side. The browser never holds them.'
    };
  }

  /* ---------- Safe OAuth error handling ----------
     Maps Google's OAuth error codes onto the shared failure taxonomy
     so the user always sees a generic, secret-free message. */
  function safeOAuthError(code) {
    var map = {
      access_denied: F.PERMISSION_DENIED,
      unauthorized_client: F.PERMISSION_DENIED,
      invalid_grant: F.AUTH_EXPIRED,
      invalid_client: F.AUTH_REQUIRED,
      invalid_request: F.INVALID_REQUEST,
      invalid_scope: F.INVALID_REQUEST,
      unsupported_response_type: F.INVALID_REQUEST,
      server_error: F.UNAVAILABLE,
      temporarily_unavailable: F.UNAVAILABLE
    };
    var failure = map[code] || F.UNKNOWN;
    return (window.Providers && window.Providers.safeMessage)
      ? window.Providers.safeMessage(failure)
      : 'Something went wrong. The action was not completed.';
  }

  /* ---------- Secret audit ----------
     Confirms that none of the server-side secret keys are present in
     the browser-accessible environment. Returns the per-key presence
     (booleans only — never values). */
  function secretAudit() {
    var exposure = {};
    var safe = true;
    SERVER_SECRET_KEYS.forEach(function (k) {
      var present = !!(window.Config && window.Config.has && window.Config.has(k));
      exposure[k] = present;
      if (present) safe = false;
    });
    return { secretKeys: SERVER_SECRET_KEYS.slice(), browserExposure: exposure, safe: safe };
  }

  /* A browser-safe snapshot of the non-secret configuration. */
  function browserConfig() {
    return {
      clientId: window.Config ? window.Config.get('GOOGLE_CLIENT_ID') : null,
      redirectUri: window.Config ? window.Config.get('GOOGLE_REDIRECT_URI') : null,
      services: configuredServices(),
      mode: mode(),
      callbackRoute: CALLBACK_ROUTE,
      firstLiveTestScopes: firstLiveTestScopes()
    };
  }

  window.OAuth = {
    AUTH_ENDPOINT: AUTH_ENDPOINT,
    TOKEN_ENDPOINT: TOKEN_ENDPOINT,
    CALLBACK_ROUTE: CALLBACK_ROUTE,
    SERVICES: SERVICES,
    SERVER_SECRET_KEYS: SERVER_SECRET_KEYS,
    FIRST_LIVE_TEST_LEVELS: FIRST_LIVE_TEST_LEVELS,
    configuredServices: configuredServices,
    mode: mode,
    isConfigured: isConfigured,
    scopesFor: scopesFor,
    firstLiveTestScopes: firstLiveTestScopes,
    authorizationUrl: authorizationUrl,
    setAuthState: setAuthState,
    authState: authState,
    handleCallback: handleCallback,
    exchangeCodeServerSide: exchangeCodeServerSide,
    safeOAuthError: safeOAuthError,
    secretAudit: secretAudit,
    browserConfig: browserConfig,
    isSecretKey: function (k) { return SERVER_SECRET_KEYS.indexOf(k) !== -1; },
    validRedirectUri: validRedirectUri
  };
})();
