# ROADMAP — AI Life OS

**Document type:** Delivery Roadmap
**Status:** Active
**Last updated:** 2026-09-27

Phases are mapped to the phased roadmap in the master build specification
(sections 74–79). Each phase has an exit condition — when it is met, move on.
Do not start a phase until the previous phase's exit condition is satisfied.

**Authoritative documents.** `TECHNICAL-SPEC.md` and `MVP-BUILD-PLAN.md` are not
present in this repository and have not been created. Phase 4 uses
`LIFE OS folder/LIFE OS PROJECT.md` (99 sections, §1–§99) as the master product and
build specification, and `LIFE OS folder/DEMO BUILD SPEC.md` as the MVP/demo
implementation specification. See `PRD.md` for the full mapping.

---

## Phase 1 — Specification ✅

**Objective:** Define the product and its visual language.

**Deliverables:**
- Master Build Specification (99 sections, §1–§99) — `LIFE OS folder/LIFE OS PROJECT.md`
- Design system preview — `design.html`

**Exit:** Specification reviewed; design direction chosen.

---

## Phase 2 — Demo/Simulation Build Specification

**Objective:** Write the implementation plan for the simulated demo, before any code.

**Deliverables:**
- Screen-by-screen specification for the simulated MVP
- Seed dataset definition (emails, calendar, contacts, meetings, tasks, commitments, documents)
- Deterministic AI behaviour rules (what the simulated "AI" does, and where a real model plugs in later)
- Demo walkthrough script
- User test protocol

**Exit:** Another developer could build the demo from this document alone, with no further questions.

**Status:** ✅ Complete — `LIFE OS folder/DEMO BUILD SPEC.md`.

---

## Phase 3 — Simulated MVP

**Objective:** Prove the experience using simulated data. No production integrations.

**Deliverables:**
- Simulated environment with seeded data
- AI Command Center
- My Day
- Email Intelligence (simulated inbox + classification)
- Calendar Intelligence (simulated events)
- Task Engine with extraction from email/meeting
- Reminder Engine
- Follow-Up Engine
- Commitment Engine
- Meeting audio upload simulation (pre-canned transcripts)
- Meeting Summary + Action-Item Extraction
- "What Am I Forgetting?"
- Universal Search
- User Approval & Autonomy Controls (simulated)
- Integration Health (simulated states)

**Explicitly excluded:** Real authentication, real Gmail, real Google Calendar, real AI provider calls.

**Exit:** All five user test activities (section 88 of the master spec) run end-to-end, and all eight MVP test scenarios (section 64) pass against simulated data.

**Status:** Build complete. `sim/index.html` and `sim/selftest.html` both run from
the filesystem with no build step and no server.

**Delivered:**

| Deliverable | Where |
| --- | --- |
| Simulated environment with seeded data | `sim/assets/js/data/seed.js`, `core/dates.js` (fixed clock) |
| LLM seam | `sim/assets/js/core/seam.js` — every engine calls through it |
| Provider abstraction | `core/providers.js` — registry + single call interface for OpenAI, Gmail, Google Calendar, transcription |
| Environment configuration | `core/config.js` — runtime-injected env vars; CONNECTED / NOT_CONFIGURED / INVALID_CONFIGURATION, secret-safe |
| Google OAuth structure | `core/oauth.js` — Gmail + Calendar, granular scopes, server-side token exchange, `#/oauth/google/callback` |
| Command Center + command bar | `sim/assets/js/ui/views/command.js` |
| My Day | `sim/assets/js/ui/views/day.js` |
| Email Intelligence | `engines/mail.js`, `ui/views/mail.js` (all 8 categories) |
| Calendar Intelligence | `ui/views/calendar.js` (day strip, conflict detection) |
| Task Engine | `engines/priority.js`, `engines/tasks.js` |
| Reminder Engine | `core/store.js` reminders, surfaced in the briefing |
| Follow-Up Engine | `engines/followup.js` — Waiting For is a distinct derived state |
| Commitment Engine | `engines/commitment.js` — direction, certainty, deadline, transcript extraction |
| Meeting transcript simulation | `ui/views/meetings.js` — 3 meetings, editable transcripts |
| Meeting Summary + Action-Item Extraction | `engines/briefing.js` `forEvent()`, transcript editor |
| What Am I Forgetting? | `engines/forgetting.js` (F-1…F-6), `ui/views/forget.js` |
| Universal Search | `engines/search.js`, `engines/briefing.js` `answer()` |
| Approval & Autonomy Controls | `core/store.js`, `ui/views/control.js` |
| Action Authorization Layer | `core/actions.js` — risk + decision for every action; email send enforced via `sendEmailAuthorized` |
| Integration Health | `sim/assets/js/core/seam.js` simulated states, Control screen |
| Automated test suite | `sim/selftest.html` — 167 checks, all passing |

**Exit condition status:**

| Condition | Status |
| --- | --- |
| Runs from a static host with no backend | ✅ Opens from `file://` |
| All nine screens exist and are navigable | ✅ 10 routes, verified rendering |
| All eight MVP test scenarios pass | ✅ Asserted in the self-test |
| Demo walkthrough runs without intervention | ✅ Continuous ABC-proposal story |
| Five user test activities completable unassisted | ⚠️ **Not yet run with real users** |
| Failure states visible and actionable | ✅ Scam email held, integration error states, autonomy gates |
| LLM seam defined, all engines call through it | ✅ `core/seam.js` |

**Remaining before the phase is closed:** run the five user test activities with
five real users and record the findings (items 8 and 9 of the Phase 3 definition
of done). Everything else is built and verified.

**Bug fixed (2026-10-01):** the Cancel button on the task, contact, and
document modals did not respond — it closed the modal and it instantly
re-opened, because those modals are rendered for detail routes
(`#/tasks/:id` etc.) and their `onClose` re-ran `render()`, re-invoking
the same route. Fixed in `app.js` by tracking the last non-modal route and
navigating back to it on close; the documents modal's internal navigation
now goes through the router so the URL stays in sync. Two regression tests
(`cancel closes the task modal`, `cancel closes the document modal`) were
added to `sim/selftest.html`, which previously only checked that modals
*open*.

**Action Authorization Layer (2026-10-03):** a pure authorization layer
(`core/actions.js`) now decides every action the AI may take into one of four
modes — `execute`, `approve`, `onetouch`, `block` — and never performs a side
effect itself. Anything that reaches another person always needs explicit human
approval regardless of the autonomy level. External email is sent only through
`Store.mut.sendEmailAuthorized`, the single enforcement point: either the user
clicks "Send" on a draft (per-send approval) or a **one-touch template** the
user authorized covers exactly one send — and that authorization is single-use
and consumed on send, after which normal approval resumes. There is no code path
to permanent auto-send. The Control screen gained a "One-touch email templates"
section (create/inspect/revoke) and an "Action authorization log" (every
decision). Eight new self-test checks cover the decision modes, single-use
consumption, the blocked resend of a consumed template, send-once, and the
audit log.

**Provider abstraction + environment configuration + failure handling
(2026-10-03):** two new modules prepare the architecture for live providers
without requiring credentials. `core/config.js` reads provider configuration
from a runtime-injected environment (never from source) and validates it as
**CONNECTED / NOT_CONFIGURED / INVALID_CONFIGURATION**, naming keys but never
values. `core/providers.js` is the registry and single call interface for the
four providers (OpenAI LLM, Gmail, Google Calendar, transcription); it owns
configuration, connection state, and the **§55 failure taxonomy** (eight
states: not configured, auth required, auth expired/revoked, unavailable,
rate limited, invalid request, permission denied, unknown). Raw provider
errors are reduced to a safe category without leaking the response, and safe
messages never contain secrets. In **DEMO MODE** (no config injected) the LLM
provider is served by the existing simulated seam and external providers
refuse with `not_configured`; live calls are a Phase 5/6 concern. The Control
screen gained a **Providers** section showing each provider's configuration
status and a selector to preview every failure state. Secrets stay
server-side: `.env`/`.env.*` are gitignored and `.env.example` files
(root + `supabase/`) document every variable with empty placeholders. The
Action Authorization Layer is unchanged. Sixteen new self-test checks cover
config detection, missing/malformed/valid/partial configuration, the
taxonomy, safe error handling, mock provider operation, and re-assert that
the authorization layer is unchanged.

**Google OAuth structure (2026-10-03):** `core/oauth.js` prepares live
Google authorization for Gmail and Calendar — structure only, no live
credentials, no auto-connect. One coherent Google OAuth architecture
covers both services with explicit, granular scopes. The app-internal
callback route is `#/oauth/google/callback` (determined from the app's
`#/path/params` hash router); the external redirect URI is a
configurable, non-secret value registered in Google Cloud Console and is
never guessed. The first live test requests **read-only** scopes only
(`gmail.readonly` + `calendar.readonly`); draft creation
(`gmail.modify`), sending (`gmail.send`, sensitive) and calendar-write
(`calendar.events`) are separated and opt-in. The browser holds only
non-secret config (`GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`,
`GOOGLE_SERVICES`, `LIFEOS_MODE`); the Client Secret, access token and
refresh token are **server-side only** and never reach `window`, HTML,
`localStorage`, or `sessionStorage`. The browser never performs the token
exchange — it builds the authorization URL, sends the user to Google's
consent screen, and hands the returned code to a controlled backend. The
Gmail rule is unchanged (READ → UNDERSTAND → DRAFT → USER APPROVES →
SEND; one-touch templates stay single-use). The Control screen gained a
**Google sign-in** section. Twenty-two new self-test checks cover OAuth
config detection, missing/invalid/valid redirect URI, auth states, safe
OAuth errors, the secret audit, a storage scan, and the unchanged
authorization layer.

**Recorded deviations from `DEMO BUILD SPEC.md`:**

1. **Classic scripts, not ES modules.** Every file attaches a global namespace
   (`window.D`, `window.Store`, `window.EnginesPriority`, `window.App`). ES
   modules are blocked by CORS on `file://`, and "open the file and it works" is
   worth more here than module syntax. The Phase 4 build converts to modules.
2. **Priority bands are applied at ≥60 / ≥30 per spec §6.3**, but the Command
   Center surfaces High *and* Medium items, because the seed data is built to
   produce four priority items on the morning of 2026-09-22.
3. **Forgetting detection returns four items, not the three the spec predicts.**
   F-6 (a task waiting on someone for more than five days) fires on `t12`, which
   the spec's five rules do admit. Rather than suppress a legitimate finding to
   hit a count, the count is asserted as four and each item is traceable to its
   source.

---

## Phase 4 — Data Model + Authentication

**Objective:** Real users, real isolation.

**Deliverables:**
- Production schema from section 49 of the master spec
- Database migrations and seed script
- Supabase authentication
- Row-level security and user data isolation
- Account recovery, data export, data deletion

**Exit:** A user can sign up, see only their own data, and export or delete it. No cross-user data exposure.

**Status: blocked on schema authorisation — no database work started.**

The Phase 4 goal is real PostgreSQL → real RLS → synthetic data → *verified*
cross-user isolation. A design that merely looks correct does not satisfy it.

Work stopped before schema design for two reasons:

1. **The schema's source of truth is unresolved.** `TECHNICAL-SPEC.md` does not
   exist in this repository. §49 of the master spec is being used in its place, but
   §49 lists field names only — no data types, nullability, foreign-key targets,
   uniqueness rules, or indexes. Filling those in is design work, and the resulting
   schema would be an inference presented as a specification.
2. **No database instance is reachable.** Docker Desktop cannot run in this
   environment (`HypervisorPresent` is `False`, WSL is absent, the shell is not
   elevated). A native PostgreSQL 16.4 install reached `initdb` successfully but all
   backends then failed with `0xC0000142`, so no server survived to test against.
   Hosted PostgreSQL (Supabase Cloud) is the agreed destination.

**Required before Phase 4 resumes:**

| Input | Why it is needed |
| --- | --- |
| RECONCILIATION ISSUES 1, 4, 7 **APPROVED 2026-10-03** (`DATABASE-DESIGN-DECISIONS.md` §11.9) | `projects` (1), `transcripts` (4), `action_items.user_id` (7) approved; issue 2 (`workspace_members`) deferred by recommendation |
| Supabase project URL, anon key, service-role key | Required to run migrations and prove RLS |

Type/constraint/key derivation is authorised and drafted in
`DATABASE-DESIGN-DECISIONS.md` (48 derived decisions, §12).

**Constraints carried into Phase 4:** hosted PostgreSQL only, no SQLite; no Docker
or WSL troubleshooting; no live Gmail, Calendar, or WhatsApp integration; the
isolation test must execute and be observed, not merely designed; credentials live
in environment variables and are never committed.

---

## Phase 5 — Core Engines on Real Data

**Objective:** Make the intelligence genuinely work.

**Deliverables:**
- Commitment Engine (direction detection: user → others, others → user, mutual, uncertain)
- Priority Engine (explainable, editable)
- Follow-Up Engine with distinct "waiting for" state
- Memory Engine with provenance (source, date, context, confidence)
- AI confidence model applied to material decisions
- Source attribution on every AI output
- Approval and confirmation flow
- Correction learning

**Exit:** All MVP acceptance criteria in section 63 of the master spec pass on real user data.

---

## Phase 6 — Live Integrations

**Objective:** Connect real sources.

**Deliverables:**
- Gmail OAuth, scopes, sync, watch/push
- Google Calendar integration
- Secure token storage and refresh
- Error states, reconnect, disconnect
- Integration Health reflecting true state

**Exit:** Real inbox and calendar working end-to-end; the Integration Health screen reports accurate status.

---

## Phase 7 — Pilot + Iteration

**Objective:** Validate with real users before scaling.

**Deliverables:**
- Pilot with 5–20 users
- Instrument the metrics from section 65 of the master spec
- Fix what is actually broken
- Prioritise the backlog from real usage, not assumptions

**Exit:** The definition of done in section 99 is met, with an early signal on 30-day retention.

---

## Phase 8+ — Post-Validation

**Objective:** Expand only what validation proved.

Candidates (from spec sections 76–79): Microsoft 365, advanced meeting intelligence, document intelligence, delegation and dependency management, WhatsApp Business, voice interface, Slack/Zoom/Teams, Drive/OneDrive, mobile applications, workspaces, integration marketplace.

**Rule:** Nothing enters this phase without evidence from Phase 7.

---

## Sequencing Rules

These exist because they are the most likely ways this project loses momentum.

1. **Do not begin Phase 6 before Phase 3 works.** This is the single biggest scope trap. Live integrations are where projects stall, because OAuth and sync failure states are far harder than a convincing simulation.
2. **Do not build Phase 5 engines before Phase 3 proves the experience is compelling.** If users do not care about the simulation, better models will not save it.
3. **Protect the Commitment Engine.** It is the product. Everything else is supporting cast. If time runs short, cut breadth — keep commitment, priority, and follow-up detection working well.
4. **One phase at a time.** Do not run Phase 4 and Phase 5 in parallel. The engines need real schema to be testable.

---

## Current Position

**Phase 3 — Simulated MVP — automated validation complete; five-user human
validation outstanding.**

Phases 1 and 2 are complete. The Phase 3 build is finished and verified by
`sim/selftest.html` (167 checks passing, including the Action Authorization
Layer, the provider abstraction, and the Google OAuth structure). The phase is **not closed**: it closes
only when five users complete the five test activities and their findings are
prioritised into a Phase 4/5 backlog.

**Phase 4A — documentation reconciliation: complete.**

**Phase 4B — database implementation: pending, no SQL written.** The derived schema
design is drafted in [`DATABASE-DESIGN-DECISIONS.md`](DATABASE-DESIGN-DECISIONS.md)
and carries eight open specification reconciliation issues, four of which require
approval before any table is created. A hosted PostgreSQL instance has not been
provisioned yet.