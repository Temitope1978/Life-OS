/* ============================================================
   PROVIDER REGISTRY + FAILURE TAXONOMY  (spec §54, §55)
   ------------------------------------------------------------
   Separates Life OS business logic from external providers.
   Business logic asks the registry for a provider and calls it
   through one interface; the registry owns configuration,
   connection state, and failure handling.

   Providers: OpenAI (LLM), Gmail, Google Calendar, and meeting
   transcription. None require live credentials to load — with no
   configuration the app runs in DEMO MODE and LLM calls are
   served by the simulated intelligence seam (core/seam.js).

   SECURITY: no API key, OAuth secret, token, or database
   credential is ever hard-coded here. Configuration is read from
   the environment (core/config.js). Failures are reduced to a
   safe category and a generic message — raw provider responses
   and secrets are never surfaced to the user.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Failure taxonomy (spec §55) ----------
     Every provider failure maps to exactly one of these eight. Each has
     a user-safe message that never exposes secrets, tokens, or
     raw provider responses. "auth_expired" covers both expired and
     revoked credentials — the user action is the same: reconnect. */
  var FAILURE = {
    NOT_CONFIGURED:    'not_configured',
    AUTH_REQUIRED:     'auth_required',
    AUTH_EXPIRED:      'auth_expired',
    UNAVAILABLE:       'unavailable',
    RATE_LIMITED:      'rate_limited',
    INVALID_REQUEST:   'invalid_request',
    PERMISSION_DENIED: 'permission_denied',
    UNKNOWN:           'unknown'
  };

  var FAILURE_MESSAGES = {};
  FAILURE_MESSAGES[FAILURE.NOT_CONFIGURED]    = 'Not configured. Add credentials to connect this provider.';
  FAILURE_MESSAGES[FAILURE.AUTH_REQUIRED]     = 'Sign-in required. Reconnect to grant access.';
  FAILURE_MESSAGES[FAILURE.AUTH_EXPIRED]      = 'Sign-in expired or revoked. Reconnect to restore access.';
  FAILURE_MESSAGES[FAILURE.UNAVAILABLE]       = 'The service is unavailable right now. Try again later.';
  FAILURE_MESSAGES[FAILURE.RATE_LIMITED]      = 'Too many requests. Wait a moment and try again.';
  FAILURE_MESSAGES[FAILURE.INVALID_REQUEST]   = 'The request was invalid. Check the input and try again.';
  FAILURE_MESSAGES[FAILURE.PERMISSION_DENIED] = 'You do not have permission for that action.';
  FAILURE_MESSAGES[FAILURE.UNKNOWN]           = 'Something went wrong. The action was not completed.';

  /** User-safe message for a failure code. Never includes secrets. */
  function safeMessage(code) {
    return FAILURE_MESSAGES[code] || FAILURE_MESSAGES[FAILURE.UNKNOWN];
  }

  /**
   * Reduce a raw provider error to a safe failure category WITHOUT
   * leaking the raw response. Accepts an HTTP status, an error code,
   * or an object with { status, code, message }.
   */
  function classify(raw) {
    if (raw === null || raw === undefined) return FAILURE.UNKNOWN;
    var status = (typeof raw === 'object') ? (raw.status || raw.code) : raw;
    var message = (typeof raw === 'object' && raw.message) ? String(raw.message) : '';

    if (status === 401) return FAILURE.AUTH_REQUIRED;
    if (status === 403) return FAILURE.PERMISSION_DENIED;
    if (status === 404 || status === 422) return FAILURE.INVALID_REQUEST;
    if (status === 429) return FAILURE.RATE_LIMITED;
    if (typeof status === 'number' && status >= 500) return FAILURE.UNAVAILABLE;
    if (/expired|revoked|invalid_grant/i.test(message)) return FAILURE.AUTH_EXPIRED;
    return FAILURE.UNKNOWN;
  }

  /* ---------- Provider ---------- */
  function Provider(def) {
    this.id = def.id;
    this.name = def.name;
    this.kind = def.kind;                 // llm | email | calendar | transcription
    this.description = def.description || '';
    this.requiredConfig = def.requiredConfig || [];
    this.validators = def.validators || {};
    this._failure = null;                 // transient simulated failure (demo/test)
  }

  /** Config tri-state: CONNECTED / NOT_CONFIGURED / INVALID_CONFIGURATION. */
  Provider.prototype.configStatus = function () {
    return window.Config.validate(this.requiredConfig, this.validators);
  };

  /**
   * Combined view for the UI:
   *   config  — the tri-state above
   *   failure — the current failure code, or null
   *   message — a user-safe string
   */
  Provider.prototype.status = function () {
    var cs = this.configStatus();
    if (this._failure) {
      return { config: cs, failure: this._failure, message: safeMessage(this._failure) };
    }
    if (cs.status === 'CONNECTED') {
      return { config: cs, failure: null, message: 'Connected.' };
    }
    if (cs.status === 'INVALID_CONFIGURATION') {
      var bad = cs.invalid.concat(cs.missing);
      return {
        config: cs, failure: null,
        message: 'Invalid configuration — check: ' + bad.join(', ')
      };
    }
    return { config: cs, failure: null, message: 'Not configured — running in demo mode.' };
  };

  /**
   * The single call interface. In DEMO MODE the LLM provider is served
   * by the simulated seam; external providers report their state. Live
   * calls are a Phase 5/6 concern and are never made from the browser.
   */
  Provider.prototype.invoke = function (method, payload) {
    if (this._failure) {
      return { ok: false, error: this._failure, message: safeMessage(this._failure) };
    }
    var connected = this.configStatus().status === 'CONNECTED';
    if (!connected) {
      if (this.kind === 'llm') return this._simulate(method, payload);
      return { ok: false, error: FAILURE.NOT_CONFIGURED, message: safeMessage(FAILURE.NOT_CONFIGURED) };
    }
    /* CONNECTED, but live provider calls are not implemented in this build. */
    return {
      ok: false, error: FAILURE.UNKNOWN,
      message: 'Live ' + this.name + ' calls are not implemented in this simulation.'
    };
  };

  /* DEMO MODE: route LLM calls to the simulated intelligence seam. */
  Provider.prototype._simulate = function (method, payload) {
    var seam = window.Intelligence && window.Intelligence.get();
    if (!seam || typeof seam[method] !== 'function') {
      return { ok: false, error: FAILURE.UNKNOWN, message: 'Simulated provider has no "' + method + '" operation.' };
    }
    try {
      return { ok: true, result: seam[method](payload), provider: 'simulated' };
    } catch (e) {
      return { ok: false, error: FAILURE.UNKNOWN, message: 'Simulated provider failed.' };
    }
  };

  /* Demo/test hooks: simulate a transient failure state. */
  Provider.prototype.simulateFailure = function (code) {
    this._failure = (code && FAILURE_MESSAGES[code]) ? code : null;
  };
  Provider.prototype.clearFailure = function () { this._failure = null; };

  /* ---------- Registry ---------- */
  var providers = [];

  function register(def) {
    var p = new Provider(def);
    providers.push(p);
    return p;
  }
  function get(id) {
    for (var i = 0; i < providers.length; i++) if (providers[i].id === id) return providers[i];
    return null;
  }
  function all() { return providers.slice(); }
  function byKind(kind) { return providers.filter(function (p) { return p.kind === kind; }); }

  /** True when no provider is fully connected → the app runs in DEMO MODE. */
  function demoMode() {
    return !providers.some(function (p) { return p.configStatus().status === 'CONNECTED'; });
  }

  /** Safe summary for display/logging: no secret values, ever. */
  function summary() {
    return providers.map(function (p) {
      var st = p.status();
      return {
        id: p.id, name: p.name, kind: p.kind,
        configStatus: st.config.status,
        missing: st.config.missing,
        invalid: st.config.invalid,
        failure: st.failure,
        message: st.message
      };
    });
  }

  /* Register the four providers. */
  register({
    id: 'openai', name: 'OpenAI', kind: 'llm',
    description: 'Intelligence: classification, extraction, briefing, memory.',
    requiredConfig: ['OPENAI_API_KEY'],
    validators: { OPENAI_API_KEY: function (v) { return /^sk-[A-Za-z0-9_\-]{16,}$/.test(String(v)); } }
  });
  register({
    id: 'gmail', name: 'Gmail', kind: 'email',
    description: 'Read and triage email; draft and send with authorization.',
    requiredConfig: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ACCESS_TOKEN'],
    validators: {
      GOOGLE_CLIENT_ID: function (v) { return /\.apps\.googleusercontent\.com$/.test(String(v)); },
      GOOGLE_CLIENT_SECRET: function (v) { return String(v).length >= 16; }
    }
  });
  register({
    id: 'google_calendar', name: 'Google Calendar', kind: 'calendar',
    description: 'Read events, detect conflicts, draft events with approval.',
    requiredConfig: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ACCESS_TOKEN'],
    validators: {
      GOOGLE_CLIENT_ID: function (v) { return /\.apps\.googleusercontent\.com$/.test(String(v)); },
      GOOGLE_CLIENT_SECRET: function (v) { return String(v).length >= 16; }
    }
  });
  register({
    id: 'transcription', name: 'Meeting transcription', kind: 'transcription',
    description: 'Transcribe uploaded meeting audio (Whisper).',
    requiredConfig: ['OPENAI_API_KEY'],
    validators: { OPENAI_API_KEY: function (v) { return /^sk-[A-Za-z0-9_\-]{16,}$/.test(String(v)); } }
  });

  window.Providers = {
    FAILURE: FAILURE,
    safeMessage: safeMessage,
    classify: classify,
    register: register,
    get: get,
    all: all,
    byKind: byKind,
    demoMode: demoMode,
    summary: summary
  };
})();
