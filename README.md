# LIFE OS

**AI Life OS** is an AI-powered personal executive assistant — an intelligent operating layer for everyday work and life.

It connects a user’s permitted digital information (email, calendar, meetings, tasks, documents, and more) and helps them remember, organize, prioritize, communicate, follow up, and get things done. The user stays in control. The assistant observes, understands, suggests, prepares, asks, then executes only with the right permission.

**Core promise:** Your AI personal executive assistant that remembers, organizes, plans, reminds, communicates, and helps you get things done.

**Philosophy:** Don’t manage your apps. Let your AI help manage your life across your apps.

**Mantra:** Remember less. Organize less. Search less. Worry less. Get more done.

## The problem

Important information is scattered across email, calendars, meetings, chat, documents, contacts, and task tools. People become the integration layer: they have to remember who they promised something to, who owes them something, which emails need action, and what they forgot.

LIFE OS is built to reduce that cognitive load — not by adding another isolated app, but by turning connected information into context and action.

## Product loop

**Information → Understanding → Context → Commitment → Priority → Action → Reminder → Follow-up → Memory**

The MVP must answer five questions well:

1. What needs my attention today?
2. What am I forgetting?
3. What did I promise?
4. Who am I waiting for?
5. What happened in my meetings?

## Vision

1. **AI Organizer** — email, calendar, tasks, documents, meetings, reminders
2. **AI Executive Assistant** — commitments, follow-ups, relationships, preparation, communication
3. **AI Life Operating System** — a coordination layer across personal and professional life

## Six engines

| Engine | Question it answers |
| --- | --- |
| Memory | What do I know? |
| Context | How is everything connected? |
| Commitment | What has been promised or left outstanding? |
| Priority | What matters now? |
| Action | What should happen next? |
| Learning | How can I become more useful to this person? |

The **Personal Context Graph** links people, projects, meetings, emails, documents, tasks, commitments, and follow-ups so the assistant treats related items as one story, not isolated records.

## Signature experiences

- Prepare My Day
- What Am I Forgetting?
- What Did I Promise?
- Who Am I Waiting For?
- Prepare My Meeting
- Ask My Life OS

## Who it’s for (MVP)

Busy professionals, entrepreneurs, consultants, executives, and creators who manage high volumes of email, meetings, commitments, and follow-ups.

## Build approach

- **Platform:** Responsive web app / PWA
- **Path:** No-code/low-code MVP → hybrid architecture → scalable SaaS
- **Initial stack (planned):** Bubble, Supabase, Make, AI provider, speech-to-text, Gmail and Google Calendar
- **First build:** Simulated / demo MVP (prove the experience) before live production integrations
- **Then:** Functional MVP with real Gmail and Calendar, user approval, and data isolation

AI does not get unrestricted execution. High-impact actions require confirmation. Privacy, permissions, and explainability are first-class requirements.

## What’s in this folder

| Path | What it is |
| --- | --- |
| `LIFE OS folder/LIFE OS PROJECT.md` | Master build specification — the source of truth for product principles, MVP scope, architecture, data model |
| `LIFE OS folder/DEMO BUILD SPEC.md` | Phase 2 implementation specification for the simulated MVP |
| `design.html` | Visual design preview: palette, type scale, controls, Command Center |
| `sim/` | **The working simulated MVP (Phase 3).** Open `sim/index.html` in a browser |
| `sim/selftest.html` | Deterministic browser test suite — open it in a browser, no build step |
| `PRD.md` | Running log of project changes |
| `ROADMAP.md` | Eight phases with exit conditions; current position tracked there |

## Running the simulated MVP

Open `sim/index.html` directly in a browser. There is no build step, no server, and
no backend. Open `sim/selftest.html` to run the test suite.

The simulation is deterministic: one fixed date (2026-09-22) and one seed dataset
telling a single continuous story — an ABC proposal that is blocked on a client,
plus a payment-diversion scam email the system refuses to act on. Your own
decisions (tasks created, commitments confirmed, autonomy level) persist in
`localStorage` under `lifeos.sim.v1`.

## Current status

**Phase 3 — simulated MVP is built and self-tested.** Next: Phase 4 (data model
and authentication). Real integrations stay deliberately deferred until the
simulation has been validated with users.
