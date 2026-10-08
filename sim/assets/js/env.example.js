/* ============================================================
   LIFE OS — browser-safe runtime configuration (TEMPLATE)
   ------------------------------------------------------------
   This is a TEMPLATE ONLY. It contains NO credentials and is
   never loaded by the application.

   The real file, sim/assets/js/env.js, is GENERATED AT DEPLOY
   TIME by the GitHub Actions workflow (.github/workflows/
   deploy-pages.yml) from the repository secrets SUPABASE_URL
   and SUPABASE_ANON_KEY. That generated file is gitignored and
   is NEVER committed.

   The browser receives ONLY these three browser-safe values:
     * LIFEOS_MODE      — "live" to enable production auth
     * SUPABASE_URL     — public Supabase project URL
     * SUPABASE_ANON_KEY — public anon key (protected by RLS)

   The browser must NEVER receive: SUPABASE_SERVICE_ROLE_KEY,
   SUPABASE_DB_URL, SUPABASE_DB_PASSWORD, JWT secrets, OAuth
   client secrets, or any other server-side API key.

   Without env.js (local development) the app runs in DEMO MODE.
   With LIFEOS_MODE=live but missing/invalid configuration,
   production mode FAILS CLOSED (MisconfiguredAdapter) and never
   falls back to demo mode.
   ============================================================ */
window.__LIFEOS_ENV__ = {
  LIFEOS_MODE: '',        /* set to 'live' to enable production auth */
  SUPABASE_URL: '',       /* https://<project-ref>.supabase.co */
  SUPABASE_ANON_KEY: ''   /* public anon key (protected by RLS) */
};
