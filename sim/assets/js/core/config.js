/* ============================================================
   ENVIRONMENT CONFIGURATION
   ------------------------------------------------------------
   Provider configuration comes from the ENVIRONMENT, never from
   source code. In the browser the environment is injected at
   runtime (window.__LIFEOS_ENV__); in a real deployment a server
   reads OS environment variables and injects only the non-secret
   values, keeping API keys and tokens server-side.

   The simulation injects nothing, so every provider reports
   NOT CONFIGURED and the app runs in DEMO MODE.

   SECURITY: secret values are never logged, printed, or returned
   by the display helpers. Only key NAMES and presence/validity
   are ever reported.
   ============================================================ */
(function () {
  'use strict';

  var env = {};

  /**
   * Inject the environment (runtime). When called with no argument
   * it reads the injected environment object; when called with an
   * object it replaces the current values entirely (used by tests).
   */
  function load(overrides) {
    env = {};
    var src = (overrides !== undefined)
      ? overrides
      : (typeof window !== 'undefined' && window.__LIFEOS_ENV__) || {};
    if (src && typeof src === 'object') {
      Object.keys(src).forEach(function (k) { env[k] = src[k]; });
    }
  }

  /** Internal read for making provider calls. Never log this value. */
  function get(key) { return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : null; }

  function has(key) { return !!env[key]; }

  /** Safe display: reveals only that a key is set and its length,
      never its value. */
  function mask(key) {
    if (!env[key]) return '(not set)';
    return 'set · ' + String(env[key]).length + ' chars';
  }

  /** Names of configured keys (no values). */
  function configuredKeys() {
    return Object.keys(env).filter(function (k) { return !!env[k]; });
  }

  /**
   * Validate a set of required config keys.
   *   validators: { key: fn(value) -> bool }
   * Returns { status, missing, invalid, present } where status is:
   *   CONNECTED             every required key present and valid
   *   NOT_CONFIGURED        none of the required keys are present
   *   INVALID_CONFIGURATION some present, some missing, or some invalid
   */
  function validate(requiredKeys, validators) {
    validators = validators || {};
    var missing = [], invalid = [], present = [];
    requiredKeys.forEach(function (k) {
      if (!env[k]) { missing.push(k); return; }
      var fn = validators[k];
      if (fn && !fn(env[k])) { invalid.push(k); return; }
      present.push(k);
    });

    var status;
    if (present.length === requiredKeys.length) {
      status = 'CONNECTED';
    } else if (present.length === 0 && invalid.length === 0) {
      status = 'NOT_CONFIGURED';
    } else {
      status = 'INVALID_CONFIGURATION';
    }
    return { status: status, missing: missing, invalid: invalid, present: present };
  }

  /** True when nothing at all has been injected. */
  function isEmpty() { return configuredKeys().length === 0; }

  /* Auto-load from the injected environment at startup. */
  load();

  window.Config = {
    load: load,
    get: get,
    has: has,
    mask: mask,
    configuredKeys: configuredKeys,
    validate: validate,
    isEmpty: isEmpty
  };
})();
