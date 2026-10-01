# DEMO / SIMULATION BUILD SPECIFICATION

**Product:** AI Life OS
**Document type:** Phase 2 Implementation Specification
**Phase:** 2 of 8 (see `ROADMAP.md`)
**Status:** Draft — v0.1
**Last updated:** 2026-09-27
**Parent spec:** [`LIFE OS PROJECT.md`](LIFE%20OS%20PROJECT.md) — master build specification
**Design reference:** [`../design.html`](../design.html)

---

## 1. Purpose

This document specifies the simulated MVP in enough detail that it can be built
without further product decisions. It exists because the master specification
(especially sections 89, 90 and 88) established *what* the simulation must
contain and *why* — but not *how* it behaves screen by screen.

**The objective of the simulation is to demonstrate the intelligence of the
system, not merely its UI** (section 89 of the master spec).

**Success is not "the screens exist."** Success is that five test users can
complete the five activities in section 88 of the master spec without coaching,
and that at least three of them say they would miss the product if it disappeared.

---

## 2. Scope

### In scope

- Simulated data environment (seeded, no live accounts)
- AI Command Center, My Day, email and calendar views
- Task, reminder, follow-up and commitment engines
- Meeting upload simulation with pre-canned transcripts
- "What Am I Forgetting?" and Universal Search
- Approval flow and autonomy controls
- Simulated integration health and failure states

### Explicitly out of scope

| Excluded | Reason |
| --- | --- |
| Real authentication | No real user data exists yet; auth adds friction without proving the experience |
| Real Gmail / Google Calendar | Deferred to Phase 6 — see sequencing rule 1 in `ROADMAP.md` |
| Real AI provider calls | Deterministic rules first. Cost, latency and hallucination are Phase 5 concerns |
| Team/workspace features | Requires real multi-user isolation (Phase 4) |
| Mobile | Spec section 11 excludes native apps from the MVP |

**Why no real AI calls:** A simulated AI must behave *reliably* — the same input
always produces the same output, so demos never fail mid-presentation. Real model
calls are non-deterministic and add latency. The simulation must therefore use
deterministic rules, with a clearly marked seam where a real model plugs in later.

---

## 3. Architecture

### 3.1 Layering

```
┌──────────────────────────────────────────┐
│  UI LAYER                                │
│  Command Center · My Day · Inbox ·       │
│  Calendar · Meetings · Search            │
├──────────────────────────────────────────┤
│  ENGINE LAYER (deterministic, simulated) │
│  Task · Reminder · Follow-Up ·           │
│  Commitment · Priority · Memory ·        │
│  Forgetting · Search                     │
├──────────────────────────────────────────┤
│  SIMULATION LAYER                        │
│  Seeded data store · Ingestion simulator │
│  Processing queue (instant) ·            │
│  Failure injector                        │
├──────────────────────────────────────────┤
│  LLM SEAM  ← real model plugs in here    │
│  (interface defined now, unused in v0.1) │
└──────────────────────────────────────────┘
```

### 3.2 Stack

The simulation is a front-end artefact. It must run with `file://` or a single
static server, with no backend, no database server and no build step required.

| Concern | Choice | Rationale |
| --- | --- | --- |
| Markup and styling | Plain HTML/CSS | No framework overhead for a demo |
| Behaviour | Vanilla JavaScript (ES modules) | No build step; runs from `file://` |
| Data | JSON files, loaded via `fetch()` | Human-readable, easy to edit |
| Persistence | `localStorage` | Approve/reject actions must survive a refresh |
| Fonts | Plus Jakarta Sans + Inter | Matches `design.html` |
| Hosting | GitHub Pages | Free, already linked to the repository |

> **Note:** If loading JSON via `fetch()` fails on `file://` due to browser
> CORS policy, either embed the seed data as a JS module or serve over a local
> server. Plan for this before building.

### 3.3 The LLM seam

Define the interface now, implement it later. Every engine calls through this
contract so that swapping in a real model in Phase 5 touches one file.

```javascript
// Interface every AI call must satisfy
class IntelligenceProvider {
  // Classify an email. Returns { category, confidence, reason, source }
  async classifyEmail(email) {}

  // Extract commitments. Returns array of
  // { description, direction, dueDate, confidence, evidence, certainty }
  async extractCommitments(text, context) {}

  // Summarise a meeting transcript. Returns
  // { summary, decisions[], actionItems[], risks[], questions[] }
  async summariseTranscript(transcript, participants) {}

  // Produce the daily briefing. Returns a structured briefing object.
  async buildDailyBriefing(userContext) {}

  // Detect forgotten items by cross-checking sources.
  async detectForgotten(userContext) {}
}
```

**Phase 3 provides a `SimulatedProvider`** that returns pre-written results
based on rules and keywords. **Phase 5 provides a `ModelProvider`** that calls a
real model. No engine should know which one it is talking to.

---

## 4. Seed Dataset

This is the heart of the simulation. If the data is not realistic, nothing else
matters. Requirements: **20–50 emails**, several meetings with conflicts and
preparation needs, several contacts, tasks in all states, commitments in both
directions, and documents.

### 4.1 Narrative

All seed data tells one continuous story (section 90 of the master spec). The
demo persona is **Temitope**, a consultant working on the **ABC proposal**.

**The story:**
1. He is three days from submitting the ABC proposal.
2. He promised pricing to **John** (ABC Ltd) — John is still to send revised
   pricing, so the proposal is blocked.
3. He promised a document to **Mary** and has not delivered it.
4. **David** asked to reschedule a meeting and never confirmed.
5. A commitment made verbally in the Sept 15 meeting was never turned into a task.
6. Tomorrow's 2 PM meeting with ABC needs preparation and has no agenda.

This single narrative exercises all six engines: memory (who is who), context
(proposal ↔ John ↔ pricing), commitment (promises in both directions), priority
(what is due soonest), action (create task/follow-up), and learning (user
corrections).

### 4.2 Contacts

| id | Name | Organisation | Relationship | Last interaction | Outstanding with them |
| --- | --- | --- | --- | --- | --- |
| c1 | John Miller | ABC Ltd | Client — primary | Sept 15 meeting | Owes revised pricing |
| c2 | Mary Chen | Northwind Partners | Colleague | Sept 12 email | Owes her a document |
| c3 | David Okafor | Internal | Direct report | Sept 10 email | Awaiting meeting confirmation |
| c4 | Sarah Lindqvist | ABC Ltd | Client — finance | Sept 8 email | Awaiting invoice approval |
| c5 | Tom Baker | Supplier | Vendor | Sept 5 email | Nothing outstanding |
| c6 | Priya Nair | Northwind Partners | Partner | Sept 1 email | Nothing outstanding |

### 4.3 Calendar events

| id | Title | When | Attendees | Notes |
| --- | --- | --- | --- | --- |
| e1 | ABC Proposal Review | Tomorrow 14:00 | John, Sarah | Needs prep; decision pending |
| e2 | Team Standup | Tomorrow 09:30 | David, Priya | Low priority |
| e3 | Finance Sync | Today 11:00 | Sarah | Invoice discussion |
| e4 | Northwind Weekly | Today 15:00 | Mary, Priya | Routine |
| e5 | 1:1 with David | Today 13:00 | David | Follow-up from Sept 10 |
| e6 | Conflict: ABC Prep vs Supplier Call | Today 16:00 | Tom | Overlaps Northwind Weekly |

**Conflict requirement:** events e4 and e6 overlap at 15:00–16:00 so the Calendar
Intelligence conflict detection has something real to find.

### 4.4 Emails (24 messages)

Categories must span the full taxonomy in section 17: Urgent, Action Required,
Important, Waiting, Newsletter, Promotion, Low Priority, Suspicious.

| # | From | Subject | Category | Action | Deadline |
| --- | --- | --- | --- | --- | --- |
| 1 | John Miller | Re: Revised pricing | Waiting | No — awaiting their reply | Blocks proposal |
| 2 | Mary Chen | Document for the board pack | Action Required | Yes | Friday |
| 3 | David Okafor | Re: Rescheduling | Waiting | No — awaiting confirmation | — |
| 4 | Sarah Lindqvist | Invoice #4471 approval | Action Required | Yes | Today |
| 5 | Tom Baker | Contract renewal terms | Important | Yes | Sept 30 |
| 6 | Priya Nair | Board prep — what do you need? | Action Required | Yes | Tomorrow 09:00 |
| 7 | Calendar | Your day at a glance | Low Priority | No | — |
| 8 | LinkedIn | 5 people viewed your profile | Newsletter | No | — |
| 9 | AWS | Your monthly invoice is ready | Promotion | No | — |
| 10 | Unknown | URGENT: Your account will be suspended | **Suspicious** | **No — warn user** | — |
| 11 | John Miller | Quick question on scope | Urgent | Yes | Today 16:00 |
| 12 | Northwind HR | Annual leave request form | Action Required | Yes | Friday |
| 13 | Figma | Design file updated by Mary | Important | No | — |
| 14 | Stripe | Receipt for your payment | Low Priority | No | — |
| 15 | Sarah Lindqvist | Following up on invoice | Waiting | No — awaiting payment | — |
| 16 | David Okafor | Q3 numbers draft | Urgent | Yes | Tomorrow |
| 17 | ABC Security | New sign-in from new device | Important | Review | — |
| 18 | Zoom | Your meeting starts in 15 minutes | Low Priority | No | — |
| 19 | Mary Chen | Re: Re: Document for the board pack | Waiting | No — awaiting reply | — |
| 20 | Tom Baker | Newsletter: October outlook | Newsletter | No | — |
| 21 | Legal | Contract clause 4.2 needs review | Important | Yes | Sept 29 |
| 22 | Unknown | Claim your free consulting hours | Promotion | No | — |
| 23 | Priya Nair | Intro to new client contact | Action Required | Yes | This week |
| 24 | ABC Security | Verification code | Low Priority | No | — |

**Suspicious email requirement:** email 10 must be visibly flagged, with the
reason shown, and must **not** be actionable — no links to follow, no task
created.

### 4.5 Meetings and transcripts

Three meetings with realistic transcripts are required. Transcripts must contain
**naturally embedded commitments** — not labelled as such — so commitment
detection is genuinely tested.

| id | Meeting | Date | Contains |
| --- | --- | --- | --- |
| m1 | ABC Proposal Kickoff | Sept 15 | Verbal commitment to send proposal by Sept 20; John's promise to send pricing (Others → User) |
| m2 | Northwind Board Prep | Sept 12 | Mutual agreement on board date; Mary asks for a document (User → Others) |
| m3 | Internal 1:1 | Sept 10 | David's vague promise to "get the numbers over" (Possible — low confidence) |

**Transcript excerpt — m1 (Sept 15), the critical test case:**

```
JOHN: So if you can send the proposal by the 20th we can make the deadline.
TEMITOPE: Yes, I'll send the proposal by Friday.
JOHN: I'll send you the revised pricing tomorrow morning so you're not
       blocked.
TEMITOPE: That works. Let's go with the three-tier option.
```

Expected extraction:
- `I'll send the proposal by Friday` → **User → Others**, due Sept 19, high confidence
- `I'll send you the revised pricing tomorrow morning` → **Others → User**, due Sept 16, high confidence
- Three-tier option → a **decision**, not a commitment

**Transcript excerpt — m3 (Sept 10), the low-confidence test case:**

```
DAVID: I'll get the numbers over to you when I can.
TEMITOPE: Okay.
```

Expected extraction: direction unclear, **Possible** commitment, low confidence,
must require confirmation and must never silently become a confirmed commitment.

### 4.6 Tasks, commitments, follow-ups, documents

| Type | Items |
| --- | --- |
| Tasks | Completed (3), Planned (4), In Progress (2), Waiting (2), Overdue (1), Inbox (3) |
| Commitments — User → Others | Proposal to John (from m1), document to Mary, contract clause review |
| Commitments — Others → User | Pricing from John, invoice approval from Sarah |
| Follow-ups | John (pricing, 3 days overdue), Mary (document, due Friday), David (confirmation, 2 days) |
| Documents | ABC proposal v2 (draft), board pack (Mary), invoice #4471, supplier contract |

---

## 5. Screen Specifications

### 5.1 AI Command Center — home screen

**Layout:** greeting → day stats → priority list → command bar.

**Day stats** (exactly the categories from section 15 of the master spec):

| Stat | Value in seed data | Source |
| --- | --- | --- |
| Meetings | 3 | Calendar events |
| Priority items | 4 | Priority Engine |
| Waiting for | 2 | Follow-Up Engine |
| Due today | 1 | Deadline scan |
| Possible forgotten | 1 | Forgetting Engine |

**Priority list rules:**
- Sorted by: overdue → due today → blocked-by-dependency → urgency
- Each row shows title, due indicator, and dependency if blocked
- Blocked items display the blocker inline: *"Waiting on John's pricing"*

**Command bar** — the primary interaction layer (section 84 of the master spec):

| Command | Result |
| --- | --- |
| "Prepare my day" | Full briefing card |
| "What am I forgetting?" | Forgetting Engine output |
| "Who am I waiting for?" | Follow-Up list with sources |
| "What did I promise John?" | Commitment history with sources |
| "Summarize my emails" | Categorised counts + urgent items |
| Anything else | Polite fallback naming supported commands |

### 5.2 My Day

Sections in order: Meetings → Priority Tasks → Deadlines → Waiting For →
Preparation Needed → Important Emails → Commitments At Risk.

**Deadline:** shows a concise briefing, not a list dump (section 16).
Target: *"You have three meetings today. Your highest-priority task is the ABC
proposal. John has not yet sent the pricing required to complete it."*

### 5.3 Email Intelligence

- Virtual inbox with sender, subject, time, category chip
- Category chips colour-coded using the semantic palette in `design.html`
- Suspicious emails get a persistent warning banner and **no** action buttons
- Selecting an email shows: category, **reason**, source text, extracted actions
- Every classification must answer "Why did you classify this?" (section 19)
- **No permanent delete action anywhere** (section 18)

### 5.4 Calendar Intelligence

- Day and week views
- Conflicts highlighted explicitly
- Each meeting shows preparation status and outstanding commitments with attendees
- "Prepare me for this meeting" produces a briefing: participants, previous
  interactions, outstanding commitments, relevant documents, objectives

### 5.5 Meetings

- "Upload meeting" accepts a file but routes to seeded transcripts by name
- Output tabs: Transcript (editable) · Summary · Decisions · Actions · Deadlines ·
  Commitments · Follow-ups
- Extracted commitments show **Confirmed / Possible** state with source
- Speaker names match contacts where known, otherwise "Speaker 1" — and the user
  can rename (section 23)

### 5.6 What Am I Forgetting?

Cross-checks Email + Calendar + Meetings + Tasks + Commitments + Follow-Ups.

For seed data it must surface exactly these three:
1. John is waiting for the proposal (emailed Sept 15, blocked since)
2. You promised Mary a document (due Friday, not started)
3. Tomorrow's 14:00 ABC meeting requires preparation and has no agenda

Each suggestion shows **source** and **confidence**, with actions:
`Create Task` · `Remind Me` · `Ignore` · `Correct`

### 5.7 Search

Natural-language queries returning ranked results across emails, meetings,
transcripts, tasks, documents, people, commitments — each with its source.

Required queries: *"John proposal"*, *"What did I promise John?"*,
*"Who am I waiting for?"*, *"What happened at the ABC meeting?"*

### 5.8 Approval & Autonomy

- Autonomy selector: Manual · Observe · Suggest · Prepare · Confirm · Automate
  (levels 0–5 from section 14 of the master spec)
- Any AI-proposed action can be Approved, Edited or Rejected
- Approvals persist via `localStorage`
- At level 4+, high-impact actions require explicit confirmation
- Rejections feed the Learning Engine

### 5.9 Simulated Integration Health

Shows seeded states including failures, so error handling is demonstrable
(sections 42, 55): Gmail connected · Calendar connected · Transcription
**failed** (with Retry) · Microsoft 365 **authentication expired** (with
Reconnect). These must be visibly actionable, never silently broken.

---

## 6. Deterministic Rules

Rules for the SimulatedProvider. Each returns fixed output for known inputs.

### 6.1 Email classification

Match sender/subject keywords → category. Priority: Suspicious check runs first.

| Rule | Condition | Result |
| --- | --- | --- |
| R-1 | Sender not in known contacts AND urgency words (urgent, suspended, verify now) | **Suspicious**, high confidence, no actions |
| R-2 | Subject contains "invoice", "approval", "document", "numbers draft", "clause" | **Action Required** |
| R-3 | Email is a reply we are awaiting (matches a Waiting commitment) | **Waiting** |
| R-4 | Sender in contacts AND (today or overdue deadline) | **Urgent** |
| R-5 | Marketing domains (linkedin, stripe promo) | **Promotion** or **Newsletter** |
| R-6 | Automated notifications (zoom, aws, figma, calendar) | **Low Priority** or **Important** |
| R-7 | Fallback | **Low Priority**, low confidence |

Every rule must return a human-readable `reason` citing the matched evidence.

### 6.2 Commitment extraction

1. Match first-person future/commitment patterns: `I'll`, `I will`, `we agreed`,
   `let me`, `I'll send`
2. Match third-party patterns: `you'll send`, `<Name> will`, `you said you would`
3. Match deadline phrases: `by Friday`, `before the 20th`, `tomorrow morning`,
   `next week`
4. Assign direction: first-person → User → Others; third-party → Others → User;
   `we agreed` / `let's` → Mutual
5. If subject or verb is vague (`when I can`, `soon`, `asap`) → certainty
   `Possible`, confidence low

**Hard rule:** the engine must never promote a `Possible` commitment to
`Confirmed` without explicit user action (section 24).

### 6.3 Priority scoring

Deterministic score, max 100:

| Factor | Points |
| --- | --- |
| Overdue | +40 |
| Due today | +30 |
| Due within 48 hours | +15 |
| Blocked by a dependency | +20 (flag, do not deprioritise) |
| Involves external client | +10 |
| Explicitly marked urgent by sender | +10 |

Score maps to High (≥60) · Medium (30–59) · Low (<30). Always display the
factors that produced the score (section 6.4, "Priority should be explainable").

### 6.4 Forgetting detection

Flag an item as forgotten when **any** of these hold:

1. A commitment exists but no linked task
2. A meeting is within 24 hours with no preparation record
3. A follow-up is past its due date
4. An email with an extracted deadline has no corresponding task
5. A task has been `Waiting` for more than 5 days

For seed data this must yield exactly the three expected items.

---

## 7. Demo Walkthrough

The continuous story from section 90 of the master spec. Rehearse this until it
runs without fumbling.

| Beat | Action | Expected result |
| --- | --- | --- |
| **Morning** | "Prepare my day." | 3 meetings, 4 priority tasks, 2 follow-ups, 1 deadline, 1 possible forgotten commitment |
| **Before meeting** | "Prepare me for my 2 PM meeting." | Previous interaction with John, outstanding pricing issue, proposal document, the Sept 15 commitment |
| **Show dependency** | Open My Day | Proposal shows "Waiting on John's pricing" — the blocked item is visible, not buried |
| **After meeting** | Upload "ABC Proposal Kickoff" transcript | Decision (three-tier option), action items, deadline Sept 19, commitment User → Others |
| **Evening** | "What am I forgetting?" | Proposal discussed today has not been scheduled as a task |
| **Approve** | Create Task | Task appears; approval persists |
| **Next day** | Reload | Reminder references the approved task and its source |

**The two moments that must land:** the dependency explanation (the system knows
the proposal is blocked by John) and the provenance (every claim can be traced
to a source the user can open).

---

## 8. User Test Protocol

The five activities from section 88 of the master spec. Run with 5 users,
individually, 20 minutes each.

1. Connect (simulated) calendar
2. Open (simulated) email
3. Ask "Prepare my day"
4. Upload a meeting
5. Ask "What am I forgetting?"

**Observe and record:**
- What they understood without explanation
- Where they hesitated or looked confused
- What they trusted — and what they opened the source to verify
- What they rejected, and why
- What they expected the AI to do that it did not
- What they would pay for

**Do not coach.** If they get stuck, note it and move on. Hesitation is data.

**Success thresholds:**

| Metric | Target |
| --- | --- |
| Complete all five activities unassisted | ≥4 of 5 users |
| Open a source to verify an AI claim | ≥3 of 5 users |
| Say the product is worth having | ≥3 of 5 users |
| Report confusion about priority ordering | <2 users |

---

## 9. Definition of Done — Phase 3

The simulation is complete when:

1. It runs from a static host with no backend
2. All screens in section 5 exist and are navigable
3. All eight MVP test scenarios (section 64 of the master spec) pass
4. The demo walkthrough in section 7 runs end-to-end without intervention
5. All five user test activities are completable unassisted
6. Failure states are visible and actionable (integration health, transcription failure)
7. The LLM seam is defined and every engine calls through it
8. The five test users have been run and findings recorded
9. Findings are prioritised into a Phase 4/5 backlog

**Explicitly not required for Phase 3:** real authentication, real integrations,
real AI models, mobile responsiveness beyond basic window resizing.

---

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| Simulation looks convincing but proves nothing | The user test in section 8 is the real test, not the demo |
| Time spent perfecting seed data instead of building | Cap seed data effort; realistic beats voluminous |
| Deterministic rules do not transfer to real models | The LLM seam keeps the interface stable |
| Simulation becomes a dead end | Phase 4 replaces the simulation layer; screens and engines survive |
| Demo goes too well and skips validation | Run section 8 regardless of how good the demo felt |

---

## 11. Next Steps

1. Build the LLM seam interface and the SimulatedProvider stub
2. Author the seed data as JSON files
3. Build the Command Center first — it is the home screen and proves the loop
4. Add the command bar with the six supported commands
5. Build My Day, Inbox, Calendar
6. Add Meetings with the three seeded transcripts
7. Add Forgetting, Search, Approval, Integration Health
8. Run the user tests

---

**Document status:** Phase 2 specification
**Next artifact after this:** the built simulation itself (Phase 3), then the
Data Model + Authentication specification (Phase 4)