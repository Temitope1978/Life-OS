# supabase/ — Phase 4B database implementation

Real PostgreSQL, real RLS, verified cross-user isolation.

**Design rationale and all 48 derived decisions (incl. approved RECONCILIATION ISSUES 1, 4, 7): [`../DATABASE-DESIGN-DECISIONS.md`](../DATABASE-DESIGN-DECISIONS.md).**
Authoritative source: `LIFE OS folder/LIFE OS PROJECT.md` §49 / §50 / §53.

---

## Contents

| Path | Purpose |
| --- | --- |
| `config.toml` | Supabase project config, migration and seed paths |
| `.env.example` | Credential template — copy to `.env`, never commit it |
| `migrations/20261001000001_schema.sql` | 17 §49 tables + 2 additive reconciliation tables (`projects` = issue 1, `transcripts` = issue 4 — both **approved 2026-10-03**) |
| `migrations/20261001000002_indexes.sql` | 40 indexes; every `user_id` is indexed for RLS |
| `migrations/20261001000003_rls.sql` | Grants, `auth.uid()` policies, signup trigger |
| `migrations/20261001000004_export_delete.sql` | `export_user_data()` / `delete_user_data()` |
| `seed.sql` | Synthetic data for **two** users, with self-verifying checks |
| `tests/isolation.test.sql` | 45 cross-user isolation checks (§53 exit condition) |
| `run-isolation-test.ps1` | Signs in both users, runs the tests with real JWTs |

## Apply

```powershell
# 1. credentials — environment variables only
$env:SUPABASE_URL        = "https://<project>.supabase.co"
$env:SUPABASE_ANON_KEY   = "<anon key>"
$env:SUPABASE_DB_URL     = "postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres"
$env:SUPABASE_DB_PASSWORD = "<database password>"

# 2. migrations in filename order
supabase db push

# 3. seed (development only — it inserts into auth.users)
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f .\seed.sql

# 4. the exit condition
.\run-isolation-test.ps1
```

## Rollback

Migrations are forward-only (Supabase convention: each file is applied once,
in filename order, and recorded in `supabase_migrations`). No reverse
("down") migrations are authored. To undo a change, author a new forward
migration that reverses it — never edit a file that has already been
applied.

Every statement is re-run safe: tables use `create table if not exists` and
indexes use `create index if not exists`, so a partially applied migration can
be re-run without failing. `seed.sql` is idempotent via `on conflict do
nothing`.

Rollback of a bad apply, in order of preference:

1. **Point-in-time recovery** — restore from a Supabase backup taken before
   the apply (safest; no data loss).
2. **Forward fix** — author a corrective migration; preferred over dropping
   objects because it preserves the migration history and any seeded data.
3. **Drop and re-apply** — `drop schema public cascade;` then re-run
   `supabase db push` and `seed.sql`. Destructive; development only.

`delete_user_data()` (migration 0004) is the only intentional data-deleting
path, and it requires `p_confirm => true`.

## Why the test needs real JWTs

RLS keys on `auth.uid()`, which Postgres reads from the `request.jwt.claims`
setting. Testing with a superuser or the service-role key would bypass RLS
entirely, so a passing run would mean nothing. `run-isolation-test.ps1` signs in
through the Auth API and sets both `request.jwt.claims` and
`SET ROLE authenticated`, which reproduces production conditions exactly.

The test also deliberately includes **positive** checks (T1–T3, T23). A policy
that denies everything would pass every "must not see" test, so the suite proves
own-data access works before proving cross-user denial.

## Seed accounts

Both are development-only and share one obvious password. They exist so the test
can obtain two genuine JWTs.

| Email | Password |
| --- | --- |
| `demo@lifeos.local` | `demo_password_never_use_in_prod` |
| `second@lifeos.local` | `demo_password_never_use_in_prod` |

`seed.sql` refuses to run against production data by convention only — it is a
plain SQL file. Do not run it on a production project.

## Not included

- Gmail, Google Calendar, or WhatsApp integration (`ROADMAP.md` Phase 6)
- Real AI provider calls (Phase 5) — `ai_interactions` rows are `simulated-v1`
- OAuth token storage — deliberately absent from `integrations`; §53 requires
  secure token handling, so tokens belong in Supabase-managed server storage
- `pgvector` embedding columns — add later as an additive migration if the
  project's extension tier allows it
