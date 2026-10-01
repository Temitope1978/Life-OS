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

**Phase 2 — Demo/Simulation Build Specification — complete.**

The specification is written. The exit condition for Phase 2 is that another
developer could build the demo from this document alone, with no further
questions. Phase 3 (building the simulation) has not started.

The master build specification and design preview remain complete and unchanged.
