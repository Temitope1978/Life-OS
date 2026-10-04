# PRD — AI Life OS

**Document type:** Product Requirements / Change Notes
**Status:** Active
**Related spec:** [`LIFE OS folder/LIFE OS PROJECT.md`](LIFE%20OS%20folder/LIFE%20OS%20PROJECT.md) — master build specification (99 numbered sections, §1–§99)
**Repository:** https://github.com/Temitope1978/Life-OS
**Last updated:** 2026-10-01
**Roadmap:** [`ROADMAP.md`](ROADMAP.md) — eight phases, current position tracked there

---

## Purpose

This file tracks what has been done to the AI Life OS project so far: specification
clean-up, repository setup, and design artifacts. The product requirements themselves
live in the master build specification; this document is the running log of changes.

---

## Change log

### 2026-09-27 — Version control and repository setup

- Git repository initialized in the project folder and linked to the remote
  `https://github.com/Temitope1978/Life-OS.git`.
- Git identity configured: `Temitope` / `329079557+Temitope1978@users.noreply.github.com`
  (GitHub noreply address — nothing is exposed in commits).
- Git Credential Manager enabled so authentication happens **once**; subsequent
  `git push` commands require no login.
- Default branch is `main` and tracks `origin/main`.

### 2026-09-27 — Specification formatting fixes

Applied to `LIFE OS folder/LIFE OS PROJECT.md`:

| Section | Issue | Fix |
| --- | --- | --- |
| 42 — Integration Health | Escaped bold markers (`\*\*Gmail\*\*`) rendered as literal asterisks | Restored proper bold formatting |
| 10 — MVP Modules | Escaped ampersand (`User Approval \& Autonomy`) | Corrected to `&` |
| 60 — AI Usage & Cost Control | Escaped ampersand (`AI USAGE \& COST`) | Corrected to `&` |

### 2026-09-27 — Repository tidy-up

- `README.md` rewritten as a concise project overview; the full specification was
  moved out of the README into its own file.
- `.gitignore` added: secrets (`.env`, `*.pem`, `*.key`, `credentials.json`),
  build output (`node_modules/`, `dist/`, `build/`), and `*.docm`.
- Duplicate file `New folder/LIFE OS PROJECT1.md` removed — it was a stale copy
  (99.9% identical to the canonical spec). The canonical
  `LIFE OS folder/LIFE OS PROJECT.md` is retained.
- The Word file `LIFE OS PROJECT - Copy.docm` is no longer tracked; it remains on
  the local disk only. The Markdown specification is the single source of truth.
- Directory renamed: `New folder/` → `LIFE OS folder/`.

### 2026-09-27 — Design artifact created

Added `design.html` — a self-contained visual preview of the AI Life OS design
language (section 83 of the master spec: calm, intelligent, trustworthy,
organized, modern, human). Contains:

- **Colors** — brand, neutral, and semantic swatches with hex codes and usage
- **Typography** — display/heading/body scale with tabular numerals
- **Buttons** — primary, secondary, ghost, danger, plus disabled states
- **Inputs** — text, date, select, textarea, toggle, checkbox, radio
- **Command Center sample** — morning briefing card and "Ask your Life OS" bar

### 2026-09-27 — Design revision (clarity + purple)

Updated `design.html` based on review feedback:

- **Font:** headings changed from *Libre Baskerville* to **Plus Jakarta Sans** for
  greater legibility, with slightly bolder weights and tighter letter-spacing.
  Inter continues to handle body, UI, buttons, and inputs.
- **Color:** the teal palette was replaced with **purple**:
  - Primary `#14506B` → `#5B21B6`
  - Primary Strong `#0E3B50` → `#4C1D95`
  - Primary Ink `#0A2633` → `#2E1065`
  - Primary Soft `#E2EEF3` → `#EDE9FE`
  - Focus ring `#2F7EA6` → `#7C3AED`
  - Hero gradient, swatch tiles, and focus glows updated to match.

### 2026-09-27 — Phase 3: Simulated MVP built

The working simulation now lives in `sim/`. Open `sim/index.html` in any browser —
no build step, no server, no backend. Open `sim/selftest.html` for the test suite.

**Architecture (four layers, per `DEMO BUILD SPEC.md` §3):**

```
sim/
  index.html                  shell, sidebar, script order
  selftest.html               deterministic browser test suite
  assets/css/app.css          design system (purple #5B21B6, Plus Jakarta Sans + Inter)
  assets/js/
    data/seed.js              one seed story: 6 contacts, 24 emails, 6 events,
                              3 meetings, 7 commitments, 15 tasks, 4 follow-ups,
                              4 documents, 4 integrations, 3 reminders
    core/dates.js             fixed clock (SIM_TODAY = 2026-09-22) + date helpers
    core/seam.js              the LLM seam every engine calls through
    core/store.js             state, persistence (lifeos.sim.v1), mutations
    engines/                  mail, commitment, priority, tasks, followup,
                              forgetting, search, briefing
    ui/dom.js                 hyperscript helper
    ui/components.js          shared rows, chips, modals, source buttons
    ui/views/                 command, day, mail, calendar, meetings, forget,
                              search, commitments, control
    app.js                    hash router, command interpreter, badges, boot
```

**Screens:** AI Command Center · My Day · Inbox · Calendar · Meetings · What Am I
Forgetting? · Commitments & Waiting For · Universal Search · Control Centre —
plus task, contact, and document modals reached from any AI claim.

**The five signature questions, wired end to end:**

| Question | Engine | Verified by |
| --- | --- | --- |
| What needs my attention today? | `priority.js` + `briefing.js` | 4 priority items, top one explained as blocked |
| What am I forgetting? | `forgetting.js` (F-1…F-6) | 4 findings, each with a source you can open |
| What did I promise? | `commitment.js` | 7 commitments, direction + certainty + deadline |
| Who am I waiting for? | `followup.js` | Waiting For is a derived state, not a label |
| What happened in my meetings? | `commitment.js` extraction + `meetings.js` | transcripts editable, 7 commitments extracted |

**Explainability and safety are structural, not cosmetic:**

- Every AI claim carries a **Source** button that opens the exact email,
  meeting, event, or document it came from.
- Priority scores always display the factors that produced them.
- A commitment extracted at `Possible` certainty can never become `Confirmed`
  without explicit user action.
- The payment-diversion scam email (`m10`) is classified `Suspicious`, held, and
  shown **no Reply or Add-task control at all** — only "This is a scam" and
  "Mark as safe". It can never become a task.
- Autonomy level gates bulk actions: below level 3, "Prepare my meetings"
  refuses and explains why rather than acting.

**Verification.** `sim/selftest.html` runs 167 checks covering seed counts,
event conflicts, priority bands, all eight mail categories, forgetting rules,
transcript extraction, every route, modal flows, state transitions, persistence,
and reset. All pass. Two classes of defect were found and fixed this way:

- The `#/waiting` route threw on `f.meta` because it read raw store follow-ups
  instead of derived engine follow-ups. It now uses `EnginesFollowUp.followUps()`.
- `el('div.cal-event clash')` produced an invalid class token containing a space,
  and `el('tag', [children])` was treated as attributes rather than children.
  Both fixed in the hyperscript helper, so no view can repeat them.

**Deviations from `DEMO BUILD SPEC.md`, recorded deliberately:**

1. **Classic scripts instead of ES modules.** ES modules are blocked by CORS on
   `file://`. Since "open the file and it works" is the entire point of a
   simulation, each file attaches a global namespace. Phase 4 converts to modules.
2. **Forgetting detection returns four items, not the three the spec predicts.**
   F-6 legitimately fires on `t12`, a task waiting on someone for 12 days. The
   finding is correct, so it was kept and the test asserts four rather than
   weakening a rule to hit a count.
3. **The Command Center surfaces High and Medium priority items.** Bands are
   applied exactly as specified (≥60 / ≥30); the seed data is simply built to
   yield four priority items that morning.

**Not built, deliberately:** no real authentication, no live Gmail or Calendar,
no real AI provider calls, no mobile app. Persistence is `localStorage` only.

**Still open:** the five user test activities in `DEMO BUILD SPEC.md` §8 have not
been run with real users. That is the remaining Phase 3 exit condition.

### 2026-09-27 — Phase 2: Demo/Simulation Build Specification

Two documents created:

**`ROADMAP.md`** — the project broken into eight workable phases, each with
deliverables and an exit condition, plus four sequencing rules that exist
because they are the likeliest ways this project loses momentum. The critical
rule: do not begin live integrations (Phase 6) before the simulation (Phase 3)
works.

**`LIFE OS folder/DEMO BUILD SPEC.md`** — the Phase 2 implementation
specification. Contents:

- Scope, with an explicit out-of-scope table (no real auth, integrations or AI
  calls in Phase 3, and the reason for each)
- Four-layer architecture with the **LLM seam** — the interface a real model
  plugs into in Phase 5, defined now so no engine knows which provider it is
- Complete seed dataset: 6 contacts, 6 calendar events (including a deliberate
  conflict), 24 emails spanning all 8 categories including a suspicious one,
  3 meetings with real transcript excerpts, and tasks/commitments/follow-ups
  across every state — all telling one continuous ABC-proposal story
- Screen-by-screen specification for all nine screens
- Deterministic rules the simulated "AI" follows: email classification
  (R-1…R-7), commitment extraction, priority scoring, forgetting detection
- Demo walkthrough script and five-user test protocol with success thresholds
- Phase 3 definition of done, risk table, and build order

### 2026-10-01 — Phase 4: specification reconciliation

No schema, migration, or database code was written. This entry records which
documents are authoritative, because the two filenames previously expected in this
project are not present in the repository.

**Missing documents, confirmed absent:**

`TECHNICAL-SPEC.md` and `MVP-BUILD-PLAN.md` do not exist, under those names or any
other. A recursive search of every `.md` file in the repository returns only:

```
PRD.md
README.md
ROADMAP.md
LIFE OS folder/DEMO BUILD SPEC.md
LIFE OS folder/LIFE OS PROJECT.md
```

Neither missing document has been authored, and no substitute was invented.

**Authoritative documents in their place:**

| Expected document | Actual authoritative source | Coverage |
| --- | --- | --- |
| `TECHNICAL-SPEC.md` | `LIFE OS folder/LIFE OS PROJECT.md` §49–§62 | Entities and fields (§49), linking rule (§50), architecture (§51–52), security (§53), AI control (§54), error handling (§55), privacy (§59), cost control (§60), performance (§61), scalability (§62) |
| `MVP-BUILD-PLAN.md` | `LIFE OS folder/DEMO BUILD SPEC.md` §1–§9 | Scope, four-layer architecture, seed dataset (§4), screens, deterministic AI rules (§6), walkthrough, user test protocol (§8), Phase 3 definition of done (§9) |

The master specification was verified structurally rather than assumed: all 99
numbered sections §1–§99 are present and the document is complete at 2,829 lines.
Both "100 sections" references in `PRD.md` and `ROADMAP.md` were corrected to 99.

**Open item now resolved.** Derivation of data types, nullability, primary keys,
foreign keys, uniqueness constraints, indexes, and delete behaviour was authorised and
drafted in [`DATABASE-DESIGN-DECISIONS.md`](DATABASE-DESIGN-DECISIONS.md) — 41
decisions, each marked as derived. No SQL has been written.

That document also raises **eight specification reconciliation issues**. The most
significant: **§49 never defines a `Project` entity, yet `tasks.project_id`,
`documents.project_id`, and the §50 Context Engine chain all depend on one.** It is
flagged with a recommended additive resolution rather than silently invented. Three
other issues — `transcripts`, workspace membership, and a missing
`action_items.user_id` — also need approval before any table is created.

**Environment findings, recorded for future reference:**

- Docker Desktop is not usable in this environment. `HypervisorPresent` is `False`,
  WSL is not installed, and the shell is not elevated, so WSL2, Hyper-V, or a
  reboot-based install path are all unavailable.
- Native PostgreSQL 16.4 was installed and `initdb` succeeded, but every backend
  process terminated with `0xC0000142` (DLL initialization failed), so no server
  remained available to test against. The database work therefore moves to hosted
  PostgreSQL (Supabase Cloud), which is also the intended production target per §51–52.
- No live Gmail, Calendar, or WhatsApp integration work was started, and none is
  authorised before the Phase 3 exit condition is met.

### 2026-10-01 — Bug fix: Cancel button on detail modals

The **Cancel** button on the task, contact, and document modals did not
respond. Clicking it closed the modal and it instantly re-opened.

**Root cause.** Those three modals are rendered for the detail routes
`#/tasks/:id`, `#/contacts/:id`, and `#/documents/:id`, and each set
`onClose: render`. Cancel calls `close()`, which clears the modal and then
runs `onClose` — i.e. `render()` — which re-ran the same detail route and
re-invoked the modal. The modal never actually closed.

The briefing, transcript, prepare-all, mail-draft, and reset modals were
unaffected: they either have no `onClose` or render a non-detail route.

**Fix** (`sim/assets/js/app.js`):

- Track `lastBaseRoute` — the last non-modal view rendered — in `render()`.
- The three detail modals now use `onClose: closeModalToBase`, which
  navigates back to that view instead of re-rendering the detail route.
- The documents modal's internal navigation (list → detail, detail → contact)
  now goes through the router (`go('#/documents/…')`, `go('#/contacts/…')`)
  rather than calling the modal functions directly, so the URL stays in sync
  and Cancel is consistent. `openSource` for a document does the same.
- `render()` still clears `#view`; `UI.modal` still clears `#modal-root`,
  so a closed modal stays closed.

**Why it slipped through.** `sim/selftest.html` asserted that modals *open*
but never clicked Cancel to check they *close*. Two regression tests now do
exactly that:

- `cancel closes the task modal`
- `cancel closes the document modal`

Both assert the modal is gone and the route has left the detail route.

**Verified.** Reproduced the dead Cancel in headless Chrome, confirmed the fix
across all nine modal types (isolated, briefing, transcript, prepare-all,
task, contact, document detail, document list, and a document opened from the
commitments page), and confirmed the previous view is restored after Cancel.
`sim/selftest.html`: **129 checks, 0 failures** (83 assertions + 46 probes),
including the two new regression tests.

### 2026-10-03 — Action Authorization Layer (email send + one-touch templates)

Implemented the authorization architecture the specification requires
(`LIFE OS PROJECT.md` §54 "AI Safety / Control Architecture", §6 email
authorization, §55 error handling) without needing any live credentials,
so it is safe to build before Phase 4B (database) and Phase 6 (integrations).

**New module** `sim/assets/js/core/actions.js` — a pure Action Authorization
Layer. Every action the AI may take is classified by risk and decided into one
of four modes; the layer never performs a side effect itself:

- `execute` — low-risk, pre-approved work that may run automatically at
  autonomy 4+ (classify, extract, draft, file, label).
- `approve` — needs an explicit human approval before it runs.
- `onetouch` — a single-use template authorization covers this exact send.
- `block` — refused (missing permission, unknown/consumed/revoked template,
  recipient outside the template, or a suspicious source).

**Hard rules enforced:**

- Anything that reaches another person **always** needs explicit human
  approval, regardless of the autonomy level. Autonomy can never override it.
- External email is never sent autonomously. The only exception is a
  **one-touch template** the user has explicitly authorized for a defined use
  case and recipient set — and that authorization is **single-use and consumed
  on send**, after which normal human approval resumes. There is no code path
  that can set up permanent unrestricted auto-send.
- A suspicious (scam-held) message can never be replied to through the layer.

**Wiring:**

- `core/store.js` — new persisted state `oneTouchTemplates` and `actionLog`;
  new mutations `createOneTouchTemplate`, `revokeOneTouchTemplate`,
  `proposeAction` (a pure query), and `sendEmailAuthorized`, the single
  enforcement point for external email. Every send decision is written to the
  audit log.
- `ui/views/mail.js` — the reply flow now goes through `sendEmailAuthorized`.
  A one-touch template matching the recipient (and with "Send external email"
  granted) offers a one-tap send that consumes the authorization; otherwise the
  draft is sent only on the user's explicit "Send" click. Once a reply is sent
  the thread shows a "Reply sent" state (send-once), not another send control.
- `ui/views/control.js` — new "One-touch email templates" section (create,
  inspect, revoke, with a "Never permanent" warning) and "Action authorization
  log" section (every proposed action and its decision).

**Tests.** Eight new checks in `sim/selftest.html` cover risk/reach
classification, the four decision modes, template recipient matching (exact
address, `@domain`, empty list), single-use consumption, the blocked resend of
a consumed template, send-once recording, and the audit log.

**Verified.** `sim/selftest.html`: **129 checks, 0 failures**. The demo's
Control view renders both new sections without error (headless Chrome smoke
test).

### 2026-10-03 — Provider abstraction + environment configuration + failure handling

Prepared the architecture for live providers (OpenAI, Gmail, Google
Calendar, meeting transcription) without requiring any credentials, so it is
safe to build before Phase 4B (database) and Phase 5/6 (live calls). The
existing Action Authorization Layer is unchanged.

**New module** `sim/assets/js/core/config.js` — environment configuration.
Provider configuration is read from a runtime-injected environment
(`window.__LIFEOS_ENV__`), never from source. In the simulation nothing is
injected, so every provider reports **NOT CONFIGURED** and the app runs in
**DEMO MODE**. Validation reports exactly three states — **CONNECTED /
NOT_CONFIGURED / INVALID_CONFIGURATION** — and only ever names keys, never
values. `Config.mask()` reveals only that a key is set and its length.

**New module** `sim/assets/js/core/providers.js` — the provider registry and
the single interface business logic uses to reach an external provider. It
owns configuration, connection state, and failure handling. It registers the
four providers (OpenAI LLM, Gmail, Google Calendar, transcription) with their
required config keys and format validators. In DEMO MODE the LLM provider is
served by the existing simulated seam (`core/seam.js`); external providers
refuse with `not_configured`. Live calls are a Phase 5/6 concern and are
never made from the browser.

**§55 failure taxonomy (eight states).** Every provider failure reduces to
one of: not configured, auth required, auth expired/revoked, unavailable,
rate limited, invalid request, permission denied, unknown. `classify()` maps
a raw error (HTTP status / code / message) to a safe category **without
leaking the raw response**, and `safeMessage()` returns a generic message that
never contains secrets or provider detail.

**UI** (`ui/views/control.js`): a new **Providers** section shows each
provider's configuration status (Connected / Not configured / Invalid
configuration) and a selector to preview every failure state and the safe
message shown to the user. It sits above the existing simulated Integration
health, which is unchanged.

**Secrets.** No API key, OAuth secret, token, or database credential is
hard-coded. `.env` and `.env.*` are gitignored (verified with `git check-ignore`
and `git add --dry-run`); the trackable `.env.example` files (root and
`supabase/`) document every variable with empty placeholders and state that
secrets are server-side only.

**Tests.** Sixteen new checks in `sim/selftest.html` cover module loading,
demo-mode detection, missing / malformed / valid / partial configuration, the
config mask, the §55 taxonomy (all eight states), safe error handling (raw
error and secret withheld), mock provider operation (LLM call served by the
simulated seam), demo-mode refusal of external providers, restoration of demo
mode, and two re-assertions that the Action Authorization Layer is unchanged
(a manual external send still needs approval even for a "connected" provider
at maximum autonomy — no permanent autonomous sending).

**Verified.** `sim/selftest.html`: **145 checks, 0 failures** (98 assertions
+ 47 probes). The demo's Control view renders the Providers section with all
existing sections intact and zero errors (headless Chrome smoke test).

### 2026-10-03 — Google OAuth structure (Gmail + Google Calendar)

Prepared the Google authorization architecture for live OAuth — **structure
only, not a live connection**. No real Google credentials are created,
required, or stored, and the app never auto-connects a Google account. The
Action Authorization Layer is unchanged.

**New module** `sim/assets/js/core/oauth.js` — one coherent Google OAuth
architecture covering both Gmail and Google Calendar, with explicit, granular
scopes per service and access level.

**Callback route.** Determined by inspecting the app's hash router
(`#/path/params` in `core/app.js`): the app-internal OAuth callback route is
**`#/oauth/google/callback`**, dispatched as the `/oauth` path with
`['google','callback']` params. This is distinct from the **external redirect
URI**, which is a configurable, non-secret value that must be registered in
Google Cloud Console and point to the hosted deployment — it is **never
guessed** (the module returns `null` until both Client ID and a valid
`https?://` redirect URI are configured).

**Scope plan (minimum for the first live test, read-only):**
- Gmail: `gmail.readonly` — read-only email intelligence.
- Calendar: `calendar.readonly` — calendar read.
- Separated but **not** requested for the first test: `gmail.modify` (draft
  creation), `gmail.send` (sending, sensitive), `calendar.events` (event
  create/modify). Sending and calendar-write are opt-in and requested only
  when explicitly needed and approved.

**Gmail authorization model (unchanged).** Normal email is
READ → UNDERSTAND → DRAFT → USER APPROVES → SEND; no permanent autonomous
sending. One-touch templates remain USER CREATES/AUTHORIZES → DEFINED
CONDITIONS → ONE SEND → AUTHORIZATION CONSUMED.

**Security boundary (critical).**
- Browser-safe, **non-secret** config may be injected into
  `window.__LIFEOS_ENV__`: `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`,
  `GOOGLE_SERVICES`, `LIFEOS_MODE`.
- **Server-side secrets — never in the browser** (never in `window`, frontend
  JS, HTML, `localStorage`, `sessionStorage`, or any client config):
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_ACCESS_TOKEN`, `GOOGLE_REFRESH_TOKEN`,
  `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`,
  `SUPABASE_DB_PASSWORD`.
- The browser **never performs the token exchange**. It builds the
  authorization URL from non-secret config, sends the user to Google's consent
  screen, and hands the returned code to a controlled backend endpoint, which
  exchanges it with the server-side Client Secret and stores the tokens
  server-side. The browser receives only a non-secret connection state.
- `OAuth.secretAudit()` confirms none of the server-side secret keys are
  present in the browser environment; the callback handler acknowledges the
  authorization code without retaining or displaying it.

**UI** (`ui/views/control.js`): a new **Google sign-in** section shows the
non-secret config (Client ID, redirect URI, callback route, enabled services),
the first-live-test scopes, the per-service auth state, and a manual
**Connect Google** action that displays the exact authorization request (the
app does not auto-navigate or auto-connect).

**Tests.** Twenty-two new checks in `sim/selftest.html` cover module loading,
the callback-route convention, demo-mode non-configuration, the never-guessed
authorization URL, missing / invalid / valid redirect-URI configuration, the
read-only first-live-test scopes, all provider authentication states
(not_configured / auth_required / connected / auth_expired), safe OAuth error
handling, the code-acknowledging (non-retaining) callback, the server-only
token exchange, the secret audit (secrets absent from browser code), a scan
confirming no token/secret is written to `localStorage`/`sessionStorage`, the
`/oauth` callback route rendering, and a re-assertion that the Action
Authorization Layer is unchanged.

**Verified.** `sim/selftest.html`: **167 checks, 0 failures** (119 assertions
+ 48 probes). The demo's Control view renders the Google sign-in section with
all existing sections intact, the authorization URL is `null` when
unconfigured, and the secret audit and storage scan are clean (headless Chrome
smoke test).

---

## Current status

**Phase 3 — Simulated MVP — built and self-tested; awaiting real user validation.**

The simulation is complete and runs from `sim/index.html` with no build step, no
server, and no backend. `sim/selftest.html` runs 167 checks (119 assertions +
48 probes) and all pass.

The Phase 3 exit condition is not yet fully met: the five user test activities
(`DEMO BUILD SPEC.md` §8) still need to be run with five real users, and the
findings prioritised into a Phase 4/5 backlog. Everything that can be verified
without a human in the loop has been.

The master build specification and design preview remain complete and unchanged.
