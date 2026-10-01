# ROADMAP — AI Life OS

**Document type:** Delivery Roadmap
**Status:** Active
**Last updated:** 2026-09-27

Phases are mapped to the phased roadmap in the master build specification
(sections 74–79). Each phase has an exit condition — when it is met, move on.
Do not start a phase until the previous phase's exit condition is satisfied.

---

## Phase 1 — Specification ✅

**Objective:** Define the product and its visual language.

**Deliverables:**
- Master Build Specification (100 sections) — `LIFE OS folder/LIFE OS PROJECT.md`
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

**Current status:** In progress — see `LIFE OS folder/DEMO BUILD SPEC.md`.

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

**Phase 2 — Demo/Simulation Build Specification — in progress.**

Phase 1 is complete. Phase 2 is the active phase.