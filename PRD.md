# PRD — AI Life OS

**Document type:** Product Requirements / Change Notes
**Status:** Active
**Related spec:** [`LIFE OS folder/LIFE OS PROJECT.md`](LIFE%20OS%20folder/LIFE%20OS%20PROJECT.md) — master build specification (100 sections)
**Repository:** https://github.com/Temitope1978/Life-OS
**Last updated:** 2026-09-27
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

**Verification.** `sim/selftest.html` runs 90+ assertions covering seed counts,
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

---

## Current status

**Phase 3 — Simulated MVP — built and self-tested; awaiting real user validation.**

The simulation is complete and runs from `sim/index.html` with no build step, no
server, and no backend. `sim/selftest.html` asserts 90+ behaviours and all pass.

The Phase 3 exit condition is not yet fully met: the five user test activities
(`DEMO BUILD SPEC.md` §8) still need to be run with five real users, and the
findings prioritised into a Phase 4/5 backlog. Everything that can be verified
without a human in the loop has been.

The master build specification and design preview remain complete and unchanged.
