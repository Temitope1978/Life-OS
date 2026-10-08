# Supabase integration — Life OS (Stage 1A, reconciled)

Stage 1A of the production authentication foundation:
Supabase email/password authentication, behind the
existing Session abstraction. The demo stays fully
functional; production mode is opt-in and fail-closed.

**This stage was reconciled against the existing Life OS
production schema** (`supabase/migrations/`). It does
**not** create a second, competing schema.

## What is in this stage

- `core/supabase-auth.js` — a `SupabaseAuthAdapter` that
  implements the Session adapter contract against the
  official `@supabase/supabase-js` client
  (`window.supabase`). It handles sign-in, sign-up,
  sign-out, session restoration and auth-state changes,
  and reads the user's **existing** `public.profiles` row.

Out of scope for this stage: Google Sign-In, ZeptoMail,
WhatsApp, Gmail/Google Calendar OAuth, the full
production data migration, and the `lifeos.sim.v1`
local-store migration. The Action Authorization Layer
remains client-side for now.

## Schema decisions (reconciled)

The existing production schema is **authoritative**. The
adapter reads only objects that already exist:

- **`public.profiles`** — columns `user_id, name, email,
  timezone, subscription, preferences, created_at`. The
  adapter reads `name`, `email`, `timezone` and
  `subscription`. It does **not** reference `display_name`
  or `avatar_url` (those columns do not exist).
- **Signup trigger** — the existing `handle_new_user()`
  function and the `on_auth_user_created` trigger on
  `auth.users` create the profile row on signup. The
  adapter **never** replaces, duplicates or issues DDL for
  them; it simply works with the profile they create.
- **Preferences** — the existing `public.preferences`
  table (per-category `category / value / source /
  confidence` rows) is the preferences store. The adapter
  does **not** create a duplicate `user_preferences`
  table and does **not** read preferences at sign-in.
  Mapping categories (autonomy, learned prefs) to the app
  is a later, app-layer concern with a defined category
  mapping.
- **Permissions** — **no** `granted_permissions` table is
  created. The Action Authorization Layer is client-side
  (`core/actions.js`, `Actions.decide` with the in-app
  user); a durable, DB-backed permission model is a
  deliberate future design (with its own RLS, grant/revoke
  flows and audit), not part of the authentication
  foundation.

### Migration status

**No new migration is required.** The existing schema
already provides everything the authentication foundation
needs (profiles, the signup trigger, RLS and grants). The
earlier, incorrect `sim/supabase/migrations/
001_auth_foundation.sql` — which assumed
`display_name` / `user_preferences` / `granted_permissions`
and replaced the signup trigger — has been **removed** so
it can never be applied by `supabase db push`. Do not
reintroduce it.

## How mode selection works

`core/config.js` reads runtime config from
`window.__LIFEOS_ENV__` (injected by the host page).

- **Demo mode (default).** `LIFEOS_MODE` is absent or
  anything other than `live`/`production`. The DemoAuth
  adapter (registered by `core/session.js`) stays
  active. Nothing Supabase-related loads and the app
  boots synchronously.
- **Production mode.** `LIFEOS_MODE` (or `LIFEOS_ENV`)
  is `live` or `production`. `SupabaseAuth.bootstrap()`
  (called from `App.boot()`) activates the Supabase
  adapter — but only when the public client configuration
  and the Supabase client are present.

Production mode **never silently falls back to demo**.
If production mode is on but Supabase is misconfigured,
a fail-closed "misconfigured" adapter is registered
instead: public routes (welcome / sign-in / sign-up)
stay open so the user can see the problem, but every
protected route is blocked and no session is ever
established.

## Configuration (non-secret only)

Set these on the host page before the core scripts load:

```html
<script>
  window.__LIFEOS_ENV__ = {
    LIFEOS_MODE: 'live',                 // production mode on
    SUPABASE_URL: 'https://<ref>.supabase.co',
    SUPABASE_ANON_KEY: '<public anon key>',
    // optional: URL of the supabase-js UMD bundle to load
    SUPABASE_CLIENT_URL: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

Only the **public** client configuration is ever sent to
the browser. The Supabase anon key is public by design —
Supabase Row Level Security protects the data.

### NEVER put in the browser

- `SUPABASE_SERVICE_ROLE_KEY`
- the database password
- the DB connection string (it embeds credentials)
- any OAuth client secret (Google, etc.)
- any third-party API key (ZeptoMail, WhatsApp, …)

These stay server-side. See `core/oauth.js`
(`SERVER_SECRET_KEYS`) for the existing secret-handling
pattern.

## Session security — where things live

This is a browser-only build. Be precise about what that
means:

- **Where the client-side session is maintained.** The
  Supabase session is persisted by `supabase-js` in the
  browser's **localStorage**, under Supabase's own key
  (`sb-<project-ref>-auth-token`). The adapter does not
  read or write that key directly; it asks the client via
  `getSession()` / `getUser()` and keeps an in-memory
  cache hydrated at boot and kept in sync via
  `onAuthStateChange()`.
- **Token material accessible to browser JavaScript.**
  The short-lived **access token** (a JWT) and the
  **refresh token** are readable by browser JavaScript,
  because `supabase-js` stores them in localStorage. Any
  same-origin script — and any XSS — can read them. The
  access token is what the client sends to Supabase APIs.
- **What is protected by Supabase.** Row Level Security
  on every table uses the access token's `sub` claim
  (`= auth.uid()`). The token is verified by Supabase's
  servers, never by browser code in this app. This adapter
  performs no JWT parsing or validation.
- **What remains server-side.** The service-role key, the
  database password, the connection string, OAuth client
  secrets and third-party API keys are never sent to the
  browser.
- **httpOnly cookies.** This build does **not** use
  httpOnly cookies and must not be described as doing so.
  If Life OS later introduces a server / SSR architecture,
  the session should move to a server-managed `httpOnly`,
  `Secure`, `SameSite` cookie; the browser would no longer
  hold the refresh token, and `supabase-js` would be
  configured with a custom storage adapter (or
  `@supabase/ssr`) that round-trips through the backend.
  That is a deliberate future change, not this stage.

## What needs a real Supabase project

The selftest exercises the adapter contract with a
clearly-marked mock client, so it runs without
credentials. The following require a real project and are
**not** faked:

- a real email/password **sign-up** (the existing
  `handle_new_user()` trigger then creates the profile)
- a real **sign-in** and **sign-out**
- **session restoration** across a reload
- reading the user's **existing** `public.profiles` row
  through the `profiles_select` RLS policy
- confirming the hosted project's Auth settings
  (Email/Password provider enabled) in the dashboard

To try it for real, configure `window.__LIFEOS_ENV__` as
above and open the app. Demo mode (the default) is
unaffected and needs no credentials. No migration needs
to be applied first — the schema already exists.
