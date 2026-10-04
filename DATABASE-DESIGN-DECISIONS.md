# DATABASE-DESIGN-DECISIONS.md

**Document type:** Technical database design decisions
**Status:** Schema authored in `supabase/` (not applied); no database created. RECONCILIATION ISSUES 1 (`projects`), 4 (`transcripts`), and 7 (`action_items.user_id`) APPROVED 2026-10-03; issue 2 (workspace membership) deferred.
**Last updated:** 2026-10-03
**Target:** Hosted PostgreSQL (Supabase Cloud)
**Master specification:** [`LIFE OS folder/LIFE OS PROJECT.md`](LIFE%20OS%20folder/LIFE%20OS%20PROJECT.md) — §49 entities, §50 relationships, §53 security, §54 AI control, §59–62
**MVP specification:** [`LIFE OS folder/DEMO BUILD SPEC.md`](LIFE%20OS%20folder/DEMO%20BUILD%20SPEC.md) — §4 seed dataset
**Status documents:** [`PRD.md`](PRD.md), [`ROADMAP.md`](ROADMAP.md)

---

## 0. How to read this document

Section 49 of the master spec lists **entity names and field names only** — no data
types, no nullability, no key strategy, no constraints, no indexes. Those decisions
have been authorised as derived work.

Every such decision is marked **[DERIVED]** and carries a rationale. Anything stated
verbatim in the spec is marked **[SPEC §nn]**. Where the spec is ambiguous or
self-conflicting, it is recorded as a **SPECIFICATION RECONCILIATION ISSUE** with a
recommendation, and is *not* silently resolved.

**Number of derived decisions: 48.** Listed in §12. (RECONCILIATION ISSUES 1, 4, and 7 are APPROVED 2026-10-03: the additive `projects` table is decision #47, the additive `transcripts` table is decision #48, and `action_items.user_id` is decision #34.)

### Source-of-truth statement

`TECHNICAL-SPEC.md` and `MVP-BUILD-PLAN.md` do not exist and have not been created.
This document is the consolidated technical database record derived from the two
authoritative specs named above. It does not replace them; where they conflict, they
win.

---

## 1. Entity to table mapping

All 17 entities from §49 map to one table each. Table names are lower snake case
plural; column names follow the spec's `snake_case` field names verbatim.

| # | §49 Entity | Table | Notes |
| --- | --- | --- | --- |
| 1 | User | `profiles` | [DERIVED] Renamed from `users` to avoid collision with Supabase's built-in `auth.users`. Maps 1:1 to `auth.users.id`. |
| 2 | Workspace | `workspaces` | |
| 3 | Contact | `contacts` | |
| 4 | Email | `emails` | |
| 5 | Calendar Event | `calendar_events` | [DERIVED] Name avoids the SQL keyword `events`. |
| 6 | Task | `tasks` | |
| 7 | Meeting | `meetings` | |
| 8 | Action Item | `action_items` | |
| 9 | Commitment | `commitments` | |
| 10 | Follow-Up | `follow_ups` | |
| 11 | Document | `documents` | |
| 12 | Memory | `memories` | |
| 13 | Preference | `preferences` | |
| 14 | Integration | `integrations` | |
| 15 | Notification | `notifications` | |
| 16 | AI Interaction | `ai_interactions` | |
| 17 | Audit Log | `audit_logs` | |
| — | **Project** | **`projects`** | ⚠️ **RECONCILIATION ISSUE 1 — see §11.1.** §49 does not define Project, but §50 chains through it and `tasks.project_id` / `documents.project_id` reference it. Recommended resolution is additive. |
| — | One-Touch Template | **`one_touch_templates`** | [DERIVED] Additive. Not in §49. Required by §6 (one-touch template exception) and §54 (Action Authorization Layer). See §3.19. |

**19 tables total.** 17 specified, plus 2 flagged additions (Project, One-Touch Template).

### 1.1 Where the spec field names are ambiguous

Two §49 fields are not single columns and must be modelled as arrays or child rows.
Neither choice is free, so both are recorded as reconciliation issues rather than
decided silently.

- `Email.recipients` — several recipients per email → [DERIVED] `TEXT[]`
- `Calendar Event.participants` — several participants per event → [DERIVED] `TEXT[]`

**Consequence of the array choice:** `array_length()` in RLS policies is
non-immutable, so any policy filtering *on* array membership must use a GIN index
plus `EXISTS`/`ANY` rather than a scalar comparison. Relevant to AI search, §9.

---

## 2. Relationships from §50

§50 states: *"Data must be linked."* and gives the chain
Meeting → Person → Project → Transcript → Commitment → Task → Deadline → Follow-up,
describing it as essential to the Context Engine.

| Relationship | Cardinality [DERIVED] | Mechanism |
| --- | --- | --- |
| Profile → Workspace (owner) | 1:1 | `workspaces.owner_id` |
| Profile → Workspace (member) | M:N | `workspace_members` (see reconciliation issue 2) |
| Workspace → Contact/Task/Project/Document | 1:M | `workspace_id` FK |
| Meeting → Transcript | 1:1 | `meetings.transcript_reference` — see issue 4 |
| Meeting → Action Item | 1:M | `action_items.meeting_id` |
| Action Item → Task | 1:1 | `action_items.task_id` |
| Meeting → Commitment | 1:M | `commitments.source` is polymorphic — see issue 3 |
| Commitment → Contact | M:1 | `commitments.person_id` → `contacts.contact_id` (naming issue 5) |
| Task → Contact | M:1 | `tasks.contact_id` |
| Task → Project | M:1 | `tasks.project_id` |
| Task → Task (dependency) | M:1 self-FK | `tasks.dependency_id` |
| Follow-Up → Contact | M:1 | `follow_ups.contact_id` |
| Document → Project/Contact | M:1 | `documents.project_id`, `documents.contact_id` |
| Memory → source | polymorphic | `memories.source` — issue 3 |
| Integration → Profile | 1:M | `integrations.user_id` |
| Notification → Profile | 1:M | `notifications.user_id` |
| AI Interaction → Profile | 1:M | `ai_interactions.user_id` |
| Audit Log → Profile | 1:M | `audit_logs.user_id` |

**All child rows carry `user_id` even where reachable through a workspace** [DERIVED].
§50 demands data be linked; §53 demands isolation. RLS is enforced with a single
consistent `user_id` predicate per table, which is far less error-prone than
traversing a join to discover ownership. The trade-off is redundancy; a trigger or
constraint keeps it honest. See §8.2.

---

## 3. Data types, required/optional, keys

Legend: **R** = required (NOT NULL), **O** = optional (nullable).

### 3.1 profiles
`profiles` — 1:1 with `auth.users`.

| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `user_id` | `UUID` PK, FK → `auth.users(id)` ON DELETE CASCADE | R | [DERIVED] §49 says `user_id`; Supabase owns identity |
| `name` | `TEXT` | R | §49 |
| `email` | `TEXT` | R | §49 |
| `timezone` | `TEXT` | R | §49. [DERIVED] `TEXT` not `TIMESTAMPTZ`; the column is an IANA name like `Europe/London`. Validated by CHECK against `pg_timezone_names` is not possible in a CHECK, so app-validated. |
| `subscription` | `TEXT` | R | §49. [DERIVED] enum-as-text with CHECK, avoids enum migration friction |
| `preferences` | `JSONB` | R | §49. [DERIVED] free-form blob, default `'{}'` |

`subscription` CHECK: `IN ('free','pro','lifetime')` [DERIVED] — tiers implied by §86 business model.

### 3.2 workspaces
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `workspace_id` | `UUID` PK, DEFAULT `gen_random_uuid()` | R | §49 |
| `name` | `TEXT` | R | §49 |
| `type` | `TEXT` | R | §49. CHECK `IN ('personal','work','shared','team')` [DERIVED] |
| `owner` | `UUID` NOT NULL, FK → `profiles.user_id` | R | §49 field is `owner`; named `owner_id` for FK clarity [DERIVED] |

### 3.3 contacts
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `contact_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `workspace_id` | `UUID` FK → `workspaces` ON DELETE SET NULL | O | §49 writes `user_id/workspace_id` |
| `name` | `TEXT` | R | §49 |
| `email` | `TEXT` | O | §49 |
| `phone` | `TEXT` | O | §49 |
| `organization` | `TEXT` | O | §49 |
| `relationship` | `TEXT` | O | §49 |

`UNIQUE (user_id, lower(email)) WHERE email IS NOT NULL` [DERIVED] — prevents duplicate
contacts per user without blocking multiple contacts with no email.

### 3.4 emails
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `email_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `provider` | `TEXT` | R | §49 |
| `external_id` | `TEXT` | R | §49 |
| `sender` | `TEXT` | R | §49 |
| `recipients` | `TEXT[]` | R | §49 — see §1.1 |
| `subject` | `TEXT` | R | §49 |
| `body_reference` | `TEXT` | R | §49 `body/reference` |
| `category` | `TEXT` | R | §49 |
| `priority` | `INTEGER` | R | §49 |
| `action_required` | `BOOLEAN` DEFAULT `false` | R | §49 |
| `received_at` | `TIMESTAMPTZ` | R | §49 |

- `UNIQUE (user_id, provider, external_id)` [DERIVED] — idempotent re-sync, required
  before Phase 6 Gmail watch/push.
- `category` CHECK over the 8 categories in `DEMO BUILD SPEC.md` §6 R-1…R-7 [DERIVED].
- **Tenancy exception:** `ON DELETE CASCADE`, not SET NULL. §49 does not use
  `workspace_id` here, so SET NULL would drop the only ownership link and silently
  orphan the row. Cascading from `user_id` is the only way to honour §59 deletion.
- `body` is *not* stored inline [DERIVED]; `body_reference` points to storage per §59
  privacy and §61 asynchronous processing.

### 3.5 calendar_events
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `event_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `external_id` | `TEXT` | O | §49 — nullable because simulation/imported events have none |
| `title` | `TEXT` | R | §49 |
| `participants` | `TEXT[]` | R | §49 — see §1.1 |
| `start` | `TIMESTAMPTZ` | R | §49 |
| `end` | `TIMESTAMPTZ` | R | §49 |
| `location` | `TEXT` | O | §49 |
| `source` | `TEXT` | R | §49 |

- CHECK `end > start` [DERIVED] — a zero/negative duration event is a data error;
  the sim's conflict detection depends on valid ranges.
- `source` CHECK `IN ('google','simulated','manual','import')` [DERIVED].

### 3.6 tasks
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `task_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `title` | `TEXT` | R | §49 |
| `description` | `TEXT` | O | §49 |
| `status` | `TEXT` | R | §49 |
| `priority` | `INTEGER` | R | §49 |
| `due_date` | `DATE` | O | §49 |
| `source` | `TEXT` | R | §49 |
| `project_id` | `UUID` FK → `projects` ON DELETE SET NULL | O | §49 |
| `contact_id` | `UUID` FK → `contacts` ON DELETE SET NULL | O | §49 |
| `dependency_id` | `UUID` FK → `tasks` ON DELETE SET NULL | O | §49 |

- CHECK `priority BETWEEN 0 AND 100` [DERIVED] — matches the 0–100 band in
  `DEMO BUILD SPEC.md` §6.3.
- CHECK prevents a task depending on itself [DERIVED] `dependency_id <> task_id`.
- `source` CHECK `('email','meeting','manual','followup','ai_suggested')` [DERIVED].
  `ai_suggested` exists because §54 lets AI propose actions that require approval, so
  provenance must be durable.

### 3.7 meetings
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `meeting_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `title` | `TEXT` | R | §49 |
| `date` | `TIMESTAMPTZ` | R | §49 |
| `source` | `TEXT` | R | §49 |
| `audio_reference` | `TEXT` | O | §49 |
| `transcript_reference` | `TEXT` | O | §49 |
| `summary` | `TEXT` | O | §49 |

Transcript is a *reference*, not an inline column — see reconciliation issue 4 (**APPROVED 2026-10-03**: additive `transcripts` table).

### 3.8 action_items
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `action_id` | `UUID` PK | R | §49 |
| `meeting_id` | `UUID` NOT NULL, FK → `meetings` ON DELETE CASCADE | R | §49 |
| `task_id` | `UUID` FK → `tasks` ON DELETE SET NULL | O | §49 |
| `owner` | `TEXT` | R | §49. Free text: may be the user *or* a contact, so not an FK — see issue 6 |
| `deadline` | `DATE` | O | §49 |
| `confidence` | `NUMERIC(4,3)` | R | §49 |

- CHECK `confidence BETWEEN 0 AND 1` [DERIVED]. `NUMERIC` not `REAL` so the §54
  confidence model does not accumulate binary float error.
- §49 gives `action_items` **no `user_id`**. Added as a denormalised column [DERIVED]
  — see §8.2 and issue 7 (**APPROVED 2026-10-03**). Without it, isolating action items requires a join through
  `meetings`, and `meetings` cascades on delete, so an RLS-only design would either be
  slower or leak.

### 3.9 commitments
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `commitment_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `person_id` | `UUID` FK → `contacts` ON DELETE SET NULL | O | §49 — name mismatch, issue 5 |
| `description` | `TEXT` | R | §49 |
| `direction` | `TEXT` | R | §49 |
| `due_date` | `DATE` | O | §49 |
| `status` | `TEXT` | R | §49 |
| `confidence` | `NUMERIC(4,3)` | R | §49 |
| `source` | `TEXT` | R | §49 |

- `direction` CHECK `IN ('user_to_other','other_to_user','mutual','uncertain')` [DERIVED]
  — exactly the four directions named in `ROADMAP.md` Phase 5.
- `confidence` CHECK 0–1 [DERIVED].
- §46/`DEMO BUILD SPEC.md` require a commitment extracted at `Possible` certainty to
  never become `Confirmed` without explicit user action. That is enforced in the
  Action Authorization Layer (§54), not by a DB CHECK — but `status` values are
  constrained [DERIVED] `('possible','confirmed','declined','fulfilled','cancelled')`
  so the transition vocabulary is closed.

### 3.10 follow_ups
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `followup_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `contact_id` | `UUID` FK → `contacts` ON DELETE SET NULL | R | §49 — the table exists to track a contact |
| `subject` | `TEXT` | R | §49 |
| `due_date` | `DATE` | O | §49 |
| `status` | `TEXT` | R | §49 |
| `source` | `TEXT` | R | §49 |

`status` CHECK `('pending','sent','replied','closed')` [DERIVED]. **Waiting For is a
derived state, not this column** [DERIVED] — `ROADMAP.md` Phase 3 states it is
computed, so it is deliberately *not* stored. See issue 8.

### 3.11 documents
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `document_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `filename` | `TEXT` | R | §49 |
| `type` | `TEXT` | R | §49 |
| `storage_reference` | `TEXT` | R | §49 |
| `project_id` | `UUID` FK → `projects` ON DELETE SET NULL | O | §49 |
| `contact_id` | `UUID` FK → `contacts` ON DELETE SET NULL | O | §49 |

### 3.12 memories
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `memory_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `category` | `TEXT` | R | §49 |
| `content` | `TEXT` | R | §49 |
| `source` | `TEXT` | R | §49 |
| `confidence` | `NUMERIC(4,3)` | R | §49 |
| `importance` | `INTEGER` | R | §49 |
| `created_at` | `TIMESTAMPTZ` DEFAULT `now()` | R | §49 |
| `expires_at` | `TIMESTAMPTZ` | O | §49 |

- CHECK `confidence BETWEEN 0 AND 1`, `importance BETWEEN 0 AND 100` [DERIVED].
- CHECK `expires_at IS NULL OR expires_at > created_at` [DERIVED].
- `expires_at` implements §49's `expires_at` and §59's retention requirement; a
  forgetting job (§45) can then filter without special-casing.
- `source` polymorphic — issue 3.

### 3.13 preferences
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `preference_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `category` | `TEXT` | R | §49 |
| `value` | `JSONB` | R | §49 |
| `source` | `TEXT` | R | §49 |
| `confidence` | `NUMERIC(4,3)` | R | §49 |

`UNIQUE (user_id, category)` [DERIVED] — one effective value per category, so the
"correction learning" in `ROADMAP.md` Phase 5 updates a row instead of accumulating
conflicting duplicates. `value` is `JSONB` because autonomy level (§54), briefing
preferences, and notification thresholds have different shapes.

### 3.14 integrations
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `integration_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `provider` | `TEXT` | R | §49 |
| `status` | `TEXT` | R | §49 |
| `permissions` | `TEXT[]` | R | §49 |
| `last_sync` | `TIMESTAMPTZ` | O | §49 |
| `error_state` | `TEXT` | O | §49 |

- `UNIQUE (user_id, provider)` [DERIVED] — §41/§42 show one row per connected
  provider per user.
- `status` CHECK `('connected','disconnected','error','reauth_required')` [DERIVED] —
  `reauth_required` exists because §53 requires integration revocation and §60/§41
  need a distinguishable expiry state.
- **No OAuth tokens are stored here** [DERIVED]. §53 requires "secure token handling"
  and §52 selects Supabase, whose `auth.integrations`/Vault pattern holds refresh
  tokens server-side. Storing them in a user-scoped table would put them behind the
  same RLS policy as ordinary data. This is a deliberate design decision, not an
  omission.

### 3.15 notifications
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `notification_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `type` | `TEXT` | R | §49 |
| `priority` | `INTEGER` | R | §49 |
| `content` | `TEXT` | R | §49 |
| `delivery_status` | `TEXT` | R | §49 |

`priority` 0–100, `delivery_status` CHECK `('pending','sent','failed','read')` [DERIVED].
§55 requires every external process to have a visible failure state, hence `failed`.

### 3.16 ai_interactions
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `interaction_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `input` | `TEXT` | R | §49 |
| `output` | `TEXT` | R | §49 |
| `model` | `TEXT` | R | §49 |
| `tokens` | `INTEGER` | R | §49 `tokens/usage` |
| `usage` | `JSONB` | O | §49 `tokens/usage` |
| `timestamp` | `TIMESTAMPTZ` DEFAULT `now()` | R | §49 |
| `action_taken` | `TEXT` | O | §49 |

`input`/`output` NOT NULL [DERIVED] even though a failed call may produce no output:
a refusal or error string is still an output, and an unlogged attempt would defeat §60
cost control. `tokens >= 0` CHECK [DERIVED].

### 3.17 audit_logs
| Column | Type | Req | Source |
| --- | --- | --- | --- |
| `audit_id` | `UUID` PK | R | §49 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | §49 |
| `action` | `TEXT` | R | §49 |
| `actor` | `TEXT` | R | §49 |
| `timestamp` | `TIMESTAMPTZ` DEFAULT `now()` | R | §49 |
| `result` | `TEXT` | R | §49 |

- `actor` is text [DERIVED]: may be `'user'`, `'ai'`, or `'system'`. §54 requires AI
  actions to be attributable and separately approvable, so AI actions must be
  distinguishable from user actions in the audit trail.
- `result` CHECK `('success','failure','denied')` [DERIVED]. `denied` is required by
  §54: a blocked autonomous action is a security event worth recording. The Action
  Authorization Layer (`core/actions.js`) records every decision here: a `block`
  decision is a `denied` audit row; `execute` / `approve` / `onetouch` that ran are
  `success` rows. The deciding mode is captured in `action` (e.g.
  `'send_external_email:onetouch'`).
- No `ON DELETE` conflict: `CASCADE` from `profiles` [DERIVED] so account deletion
  (§59) removes audit rows too, rather than failing on a RESTRICT.

### 3.18 projects — RECONCILIATION ISSUE 1, additive only — APPROVED 2026-10-03
Fields proposed only to satisfy references that already exist in §49 and §50. No
behaviour is invented beyond what those references require. **APPROVED 2026-10-03**
by explicit user decision; minimal field set confirmed (no members, goals,
milestones, or deadlines).

| Column | Type | Req | Basis |
| --- | --- | --- | --- |
| `project_id` | `UUID` PK | R | required by `tasks.project_id`, `documents.project_id`, §50 |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | isolation, §53 |
| `workspace_id` | `UUID` FK → `workspaces` ON DELETE SET NULL | O | consistency with contacts |
| `name` | `TEXT` | R | §50 names it as a linkable node; §332/§373 use it as a named thing |
| `status` | `TEXT` | O | [DERIVED] optional; §49 never specifies project lifecycle |
| `importance` | `INTEGER` | O | [DERIVED] from §278 "project importance" |
| `created_at` | `TIMESTAMPTZ` DEFAULT `now()` | R | [DERIVED] |

No members, no goals, no deadlines — none are in §49. Deliberately minimal.

### 3.19 one_touch_templates — additive, derived from §6 + §54

The one-touch template exception (§6) and the Action Authorization Layer
(§54) require a persisted, per-user, single-use authorization. §49 does not
define this entity, so it is an additive derivation. It is the *only*
mechanism by which an external email may ever be sent without a per-send
human approval, and each authorization is consumed by exactly one send.

| Column | Type | Req | Basis |
| --- | --- | --- | --- |
| `template_id` | `UUID` PK | R | [DERIVED] |
| `user_id` | `UUID` NOT NULL, FK → `profiles.user_id` ON DELETE CASCADE | R | isolation, §53 |
| `name` | `TEXT` | R | [DERIVED] human label |
| `use_case` | `TEXT` | R | §6 requires a defined use case |
| `body` | `TEXT` | R | §6 requires the template content |
| `recipients` | `TEXT[]` | R | §6 requires recipient restrictions; `@domain` entries match a whole domain |
| `conditions` | `TEXT` | O | [DERIVED] §6 "permitted conditions" |
| `created_at` | `TIMESTAMPTZ` DEFAULT `now()` | R | [DERIVED] |
| `consumed_at` | `TIMESTAMPTZ` | O | §6 single-use: set when the one send happens |
| `revoked_at` | `TIMESTAMPTZ` | O | [DERIVED] user may revoke before use |

- `CHECK (consumed_at IS NULL OR revoked_at IS NULL)` [DERIVED]: a template is
  either active, consumed, or revoked — never both consumed and revoked.
- `recipients` empty array permits **nobody** [DERIVED]: an authorization must
  name its recipients explicitly; there is no wildcard that permits everyone.
- RLS: uniform `user_id = auth.uid()` policy [DERIVED], §8. A user can never
  read or consume another user's one-touch authorization.
- No permanent auto-send: there is no `auto_send = true` column and no
  repeat count. `consumed_at` is the single-use enforcement, matching the
  simulation's `core/actions.js`.

---

## 4. Primary keys

All PKs are `UUID DEFAULT gen_random_uuid()` [DERIVED], generated client-side or by
default so no table needs a sequence round-trip.

**Exception:** `profiles.user_id` is supplied, not generated — it is the FK to
Supabase's `auth.users.id`.

Rationale for UUID over `SERIAL`/`BIGSERIAL`: §62 requires a structure that does not
make scaling impossible. UUIDs allow client-side inserts and sharding without
coordinating sequences. The cost is a larger index; for MVP volumes (§62 explicitly
says do not optimise for millions of users) that trade is correct.

---

## 5. Foreign keys

`ON DELETE` behaviour, chosen per table:

| Behaviour | Where | Why |
| --- | --- | --- |
| `CASCADE` | all `user_id` → `profiles` | §59 deletion: deleting the account must remove all personal data. `SET NULL` would orphan rows and silently leave PII behind. |
| `CASCADE` | `action_items.meeting_id` → `meetings` | An action item has no meaning without its meeting (§50 chain). |
| `SET NULL` | all `*_id` → `contacts`, `projects`, `workspaces`, `tasks` (dependency), `tasks` (from action_items) | Losing a contact must not delete the user's email history or tasks. Preserves the §59 export record and the user's data. |

Composite FK for cross-tenant integrity [DERIVED]: child tables reference
`(parent_id, user_id)` against a `UNIQUE (id, user_id)` on the parent, so a row can
never reference a parent owned by a different user. RLS would block reads, but a FK
is a hard guarantee rather than a policy convention. See issue 7 for the cost.

---

## 6. Uniqueness constraints

| Table | Constraint | Basis |
| --- | --- | --- |
| `profiles` | PK `user_id`; `UNIQUE (email)` | one profile per auth user |
| `workspaces` | PK `workspace_id`; `UNIQUE (workspace_id, owner_id)` | enables composite FK |
| `contacts` | `UNIQUE (user_id, lower(email)) WHERE email IS NOT NULL` | no duplicate contacts |
| `emails` | `UNIQUE (user_id, provider, external_id)` | idempotent sync (Phase 6) |
| `calendar_events` | `UNIQUE (user_id, source, external_id) WHERE external_id IS NOT NULL` | idempotent sync; partial because simulated events have no external id |
| `tasks` | PK; `UNIQUE (task_id, user_id)` | composite FK target |
| `preferences` | `UNIQUE (user_id, category)` | one effective value |
| `integrations` | `UNIQUE (user_id, provider)` | one connection per provider |
| `action_items` | `UNIQUE (action_id, user_id)` | composite FK target |
| `meetings` | `UNIQUE (meeting_id, user_id)` | composite FK target |
| `projects` | PK; `UNIQUE (project_id, user_id)` | composite FK target |

---

## 7. Indexes

Every table gets its PK index automatically. Additional indexes, all [DERIVED] and
justified against actual query patterns from `DEMO BUILD SPEC.md` and `ROADMAP.md`
Phase 5 engines:

| Index | Serves |
| --- | --- |
| All `user_id` columns | RLS predicates on every table — the single hottest path |
| `tasks (user_id, status, due_date)` | My Day, "what needs attention today" |
| `tasks (user_id, priority DESC)` | Priority Engine, Command Center ranking |
| `tasks (user_id, dependency_id) WHERE dependency_id IS NOT NULL` | blocked-task detection ("top item explained as blocked") |
| `tasks (user_id, contact_id)` | per-contact task lookups |
| `commitments (user_id, status, due_date)` | "What did I promise?" |
| `commitments (user_id, direction)` | direction filtering (user→other vs other→user) |
| `follow_ups (user_id, status, due_date)` | "Who am I waiting for?" |
| `emails (user_id, received_at DESC)` | Inbox, newest first |
| `emails (user_id, category, received_at DESC)` | per-category mail views, all 8 categories |
| `emails GIN (subject)` + `GIN (body_reference)` | Universal Search |
| `calendar_events (user_id, start, end)` | date-range queries + overlap conflict detection |
| `calendar_events GIST (tsrange(start, end))` | **conflict detection** via `&&` overlap |
| `meetings (user_id, date DESC)` | Meetings list |
| `action_items (user_id, meeting_id)` | per-meeting extraction results |
| `documents (user_id, project_id)` | project document views |
| `documents GIN (to_tsvector(...))` | document search |
| `memories (user_id, category, importance DESC)` | Memory Engine ranking |
| `memories (user_id, expires_at) WHERE expires_at IS NOT NULL` | forgetting/retention sweep |
| `notifications (user_id, delivery_status, priority DESC)` | undelivered high-priority |
| `ai_interactions (user_id, timestamp DESC)` | cost reporting (§60) |
| `preferences (user_id, category)` | covered by unique constraint |
| `audit_logs (user_id, timestamp DESC)` | §53 audit review |

`tsvector` indexes assume plain-to-full-text; see §9 for the vector-search caveat.

---

## 8. RLS and security implications (§53)

§53 lists twelve requirements. The system must never expose one user's data to
another. Mapping:

| §53 requirement | Mechanism [DERIVED] |
| --- | --- |
| user-level data isolation | RLS on all 18 tables + `FORCE ROW LEVEL SECURITY` so the table owner is subject too |
| access controls | `REVOKE ALL` from `anon`, grant `SELECT/INSERT/UPDATE/DELETE` to `authenticated` |
| least-privilege permissions | no `anon` access; service-role key never reaches the browser |
| encrypted communication | Supabase TLS for transport; at-rest per platform |
| secure token handling | OAuth tokens in Supabase-managed storage, never in `integrations` (§3.14) |
| OAuth for third-party integrations | Phase 6; `integrations.status='reauth_required'` models the state |
| audit logs | `audit_logs` append-only for clients — no `UPDATE`/`DELETE` grant |
| session management | Supabase Auth; no custom session table |
| account recovery | Supabase Auth recovery; `profiles` cascade on delete |
| data deletion | `ON DELETE CASCADE` everywhere from `profiles` |
| data export | `SECURITY DEFINER` RPC owned by `postgres`, not `authenticated` |
| integration revocation | delete row from `integrations`, revoke at provider |

### 8.1 Policy shape

Every table gets:

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;

CREATE POLICY <t>_select ON <t> FOR SELECT
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY <t>_insert ON <t> FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY <t>_update ON <t> FOR UPDATE
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY <t>_delete ON <t> FOR DELETE
  USING (user_id = (SELECT auth.uid()));
```

`auth.uid()` wrapped in a scalar subquery [DERIVED] so the planner evaluates it once
as an InitPlan rather than per row. On a per-row RLS predicate over a large table that
is a measurable difference.

`workspaces` is the exception: it has `owner_id`, not `user_id`, and members reach it
through `workspace_members` — see issue 2.

**Isolation is verified by execution, not by inspection.** The Phase 4 exit test must
create two real authenticated users and prove account B cannot read, insert, update,
or delete account A's rows, including via composite FKs. §53's "must never" cannot be
demonstrated by reading policy SQL.

### 8.2 Denormalised `user_id`

`action_items` receives a `user_id` not present in §49 [DERIVED]. RLS must be
evaluable from the row alone. Without it, every policy on `action_items` would need
`EXISTS (SELECT 1 FROM meetings m WHERE m.meeting_id = action_items.meeting_id AND
m.user_id = auth.uid())` — one extra join on the security path of every read.

This is recorded as issue 7 because §49's silence is real, and it is exactly the kind
of change a reviewer should see rather than discover.

### 8.3 Service role

The service-role key is used only by trusted server-side code (export, deletion,
audit writes) and is never exposed to the browser. It is read from an environment
variable; it is never committed. `.gitignore` already covers `.env`, `*.pem`, `*.key`,
`credentials.json` — a `.env.example` with empty placeholders will accompany the
migration and will hold no real values.

---

## 9. AI and vector-search requirements

§50 calls the linked data "essential to the Context Engine". §52 selects Supabase.
Relevant requirements:

- **`pgvector`** — candidate for embedding `memories.content`, `documents`, and
  transcript text so the Context Engine can retrieve semantically. Supabase supports
  the extension. ⚠️ **Not yet confirmed on the target project** — extension
  availability is project-tier dependent, and this environment has no working
  Postgres to check against.
- **Cosine distance** for similarity, `HNSW` index for scale [DERIVED].
- **Hybrid retrieval** [DERIVED]: full-text (`tsvector`, §7) *and* vector, because
  exact-match recall on names, amounts, and dates matters as much as semantics for a
  personal assistant. Vector-only search is worse at "the meeting with John on the 15th".
- **`ai_interactions`** satisfies §60 cost control: tokens and usage per model per
  user, aggregable for subscription limits.
- **`memories.source` + `confidence`** satisfy §50's provenance and §54's
  action-authorization model: an AI claim must be traceable to a source and carry a
  confidence, which is why provenance is stored rather than reconstructed.
- **No embedding column in §49 for any entity** [DERIVED] — added only if pgvector is
  confirmed, and added as an additive migration, never as a reinterpretation of §49.

**Deliberately not doing:** no AI provider calls in Phase 4. `DEMO BUILD SPEC.md`
places real model integration in Phase 5 behind the seam in `sim/assets/js/core/seam.js`.

---

## 10. Seed data plan

Source: `DEMO BUILD SPEC.md` §4, already realised in `sim/assets/js/data/seed.js`.
Counts per `PRD.md`: 6 contacts, 24 emails, 6 calendar events, 3 meetings, 7
commitments, 15 tasks, 4 follow-ups, 4 documents, 4 integrations, 3 reminders.

- Fixed clock `SIM_TODAY = 2026-09-22` [DERIVED] must be preserved, or the F-1…F-6
  forgetting rules and priority scores stop producing the verified results.
- `m10` (payment-diversion scam) must keep `category='suspicious'` and `action_required=false`.
- Seed is idempotent (`ON CONFLICT DO NOTHING`) and re-runnable [DERIVED].
- **Two users will be seeded**, not one [DERIVED] — required for the isolation test.
  The second user's rows must differ enough that a leak is unambiguous.
- No live integrations seeded; `integrations.status='simulated'`-equivalent rows only.

---

## 11. Specification reconciliation issues

Eight issues. **None is silently resolved.** Each has a recommendation; four change
the master spec and therefore need approval.

### 11.1 ISSUE 1 — `Project` is referenced but never defined ⚠️ highest impact — **APPROVED 2026-10-03**

**The conflict.** §49 enumerates 17 entities and `Project` is not among them. Yet:
- `Task.project_id` (§1366) and `Document.project_id` (§1419) both reference it
- §50's chain is Meeting → Person → **Project** → Transcript → Commitment → Task → Deadline → Follow-up
- §332 lists Project among "core nodes" of the Context Engine
- §716 "connect meetings to people/projects"; §951, §983 reference related projects
- The simulation already stores project *strings* (`'ABC proposal'`, `'Board pack'`,
  `'Internal'`, `'Vendors'`) on tasks, meetings, commitments, and documents in
  `sim/assets/js/data/seed.js`

**So §49 defines no Project table while five other places depend on one.** `tasks.project_id`
and `documents.project_id` are currently unresolvable as written.

**Recommendation — least disruptive resolution: add `projects` as an 18th table.**

Rationale:
- **Additive.** §49's 17 entities all still exist, unchanged, with all their fields. Nothing is renamed, removed, or reinterpreted, so no §49 requirement is violated.
- **Forced by existing fields.** `project_id` already appears twice in §49. Leaving it unresolved is not neutral; it means either the migration omits two §49 fields, or it creates `project_id` as an untyped loose column. Both are worse than a real table.
- **Unblocks §50.** The Context Engine chain in §50 is stated to be *essential*. It cannot work if Project is not a node.
- **Cheap to reverse.** A single added table is easier to remove or reshape than a change to 17 tables.
- **Consistent with shipped code.** `seed.js` already treats project as a real concept with repeated names, so the simulation has been modelling it informally all along.

**Cost:** it makes the schema a superset of §49, which a strict reader may object to.
**Mitigation:** keep the table strictly minimal (§3.18 — id, user, workspace, name,
status, importance, created_at). Add no members, goals, or deadlines, since §49 defines
none.

**APPROVED 2026-10-03** (explicit user approval of the additive `projects` table
with the minimal field set: `project_id`, `user_id`, `workspace_id`, `name`,
`status`, `importance`, `created_at`). No members, goals, milestones, deadlines,
or other fields were added, because §49 defines none. This is an approved
reconciliation decision, not a silent invention.

### 11.2 ISSUE 2 — Workspace membership is undefined

**The conflict.** §49 defines `Workspace` with `owner`, and `Contact` with
`user_id/workspace_id`, but nothing defines how a user *joins* a workspace they do not
own. §86 and §78 contemplate shared workspaces; §53 requires access control.

**Recommendation:** add `workspace_members (workspace_id, user_id, role)` as a small
supporting table, and give `workspaces` policies that check membership rather than
`owner_id` alone. **Alternative if you prefer no extra tables:** declare `workspaces`
personal-only for MVP (`type` limited to `'personal'`), keep the `owner_id` policy as
written, and defer sharing to Phase 8+. Given §62 says not to over-optimise for scale,
the simpler option is defensible.

### 11.3 ISSUE 3 — `source` is polymorphic and untyped

**The conflict.** `commitments.source`, `memories.source`, `tasks.source`, `tasks` and
`documents` source all mean "where did this come from", but the spec lists them as bare
`source` with no type vocabulary. For `tasks.source` I can infer an enum from the
simulation, but for `memories.source` and `commitments.source` the vocabulary is
genuinely unknown.

**Recommendation:** store the origin as text, and where the origin is a specific row,
store it as a discriminator plus an id — e.g. `source_kind` (`'email'`,`'meeting'`,
`'document'`,`'manual'`,`'inferred'`) and `source_ref` (UUID, nullable). This preserves
§50's linking requirement. **Alternatively**, keep a single `TEXT` source and accept
that some provenance is only descriptive. I have provisionally used the discriminator
split in §3 and can collapse it to plain text on request.

### 11.4 ISSUE 4 — Transcript is a reference, but §50 requires linking to it — **APPROVED 2026-10-03**

**The conflict.** §49 gives `Meeting.transcript_reference` and `Meeting.audio_reference`
as references to storage. §50 lists Transcript as a node in the chain, and
`DEMO BUILD SPEC.md` requires transcripts to be **editable in the UI**. A storage
reference cannot be edited, and there is no `transcripts` table.

**APPROVED 2026-10-03** (explicit user approval of the additive `transcripts` table). Add `transcripts (meeting_id UNIQUE, content, updated_at)` so
edits are durable, keeping `meetings.transcript_reference` for the stored audio/file.
This is additive and satisfies both §49 and §50. It introduces a 19th table beyond §49,
approved like issue 1.

### 11.5 ISSUE 5 — `Commitment.person_id` vs `Contact.contact_id`

**The conflict.** `commitments.person_id` (§1343) implies a `people` table, but §49
defines `Contact`, and `follow_ups` correctly uses `contact_id`. Also §50's chain says
"Person" while §49 says "Contact".

**Recommendation:** keep the spec's *column* name `person_id` on `commitments` for
verbatim fidelity, but point its foreign key at `contacts.contact_id`, and document
that Person ≡ Contact throughout. Renaming the column to `contact_id` would be tidier
but diverges from §49 text.

### 11.6 ISSUE 6 — `action_items.owner` is untyped and ambiguous

**The conflict.** `owner` may be the user, a contact, or unassigned. It cannot be a
single FK.

**Recommendation:** keep `owner` as text for MVP fidelity and add
`owner_contact_id UUID NULL REFERENCES contacts` for when the owner is a person other
than the user. Deferred-until-needed is also acceptable given §62.

### 11.7 ISSUE 7 — `action_items` has no `user_id` in §49 — **APPROVED 2026-10-03**

**The conflict.** §49's `Action Item` lists `meeting_id`, `task_id`, `owner`,
`deadline`, `confidence` — no `user_id`. But §53 requires isolation on every row.

**APPROVED 2026-10-03** (explicit user approval of the added `user_id UUID NOT NULL` field). Applied in §3.8:
`user_id UUID NOT NULL`, kept consistent with `meetings.user_id` by trigger, enabling
single-predicate RLS. This adds a field §49 does not list, now approved.

### 11.8 ISSUE 8 — Follow-up "waiting for" status vocabulary undefined

**The conflict.** §49 gives `follow_ups.status` with no values. §48 and the Phase 3
build treat **Waiting For as a derived state**, not a stored label. A reader of §49
alone would likely put `status='waiting'` in the column.

**Recommendation:** keep `status` as the *communication* state (`pending`,`sent`,
`replied`,`closed`) and derive "waiting" from `status='sent'` plus elapsed time.
If you prefer the stored-label reading, `status` gains a `'waiting'` value — but that
contradicts a decision already recorded in `ROADMAP.md` Phase 3, so it should be an
explicit reversal, not a quiet default.

### 11.9 Summary of approvals required

| Issue | Adds/changes | Approval status |
| --- | --- | --- |
| 1 — Project table | new table | **APPROVED 2026-10-03** |
| 2 — Workspace membership | new table or MVP restriction | **Yes** |
| 3 — Polymorphic `source` | discriminator split | No |
| 4 — Transcripts | new table | **APPROVED 2026-10-03** |
| 5 — Person ≡ Contact | FK retarget, column name kept | No |
| 6 — `owner` untyped | extra nullable column | No |
| 7 — `action_items.user_id` | extra field | **APPROVED 2026-10-03** |
| 8 — Waiting For derived | vocabulary choice | No |

**Issues 1, 4, and 7 are APPROVED (2026-10-03).** The schema now fully satisfies §49 and §50 together: the 17 §49 tables plus the approved additive `projects` (issue 1) and `transcripts` (issue 4) tables, with `action_items.user_id` (issue 7) denormalised and trigger-maintained for single-predicate RLS. **Issue 2 (workspace membership) is the only remaining reconciliation item** and is deferred by recommendation — workspaces are personal-only for the MVP (`type` limited to `'personal'`, `owner_id`-only RLS), with `shared`/`team` types reserved for a later phase.

---

## 12. All derived decisions

| # | Decision | Type |
| --- | --- | --- |
| 1 | `profiles` table name (avoid `auth.users` collision) | naming |
| 2 | `calendar_events` table name (avoid `events` keyword) | naming |
| 3 | UUID PKs with `gen_random_uuid()` | key |
| 4 | `profiles.user_id` is the FK to `auth.users.id` | key |
| 5 | `workspaces.owner` → column `owner_id` | naming |
| 6 | `TEXT` not `TIMESTAMPTZ` for `profiles.timezone` (IANA name) | type |
| 7 | `TEXT` + CHECK for `subscription` | type |
| 8 | `JSONB` for `profiles.preferences`, `preferences.value`, `ai_interactions.usage` | type |
| 9 | `TEXT[]` for `emails.recipients`, `calendar_events.participants` | type |
| 10 | `TIMESTAMPTZ` for all instants, `DATE` for `due_date`/`deadline`/`expires_at`-style day values | type |
| 11 | `NUMERIC(4,3)` for all `confidence` values | type |
| 12 | `INTEGER` 0–100 for `priority`/`importance` | type + CHECK |
| 13 | CHECK constraints on all categorical fields | integrity |
| 14 | CHECK `end > start` on `calendar_events` | integrity |
| 15 | CHECK `confidence BETWEEN 0 AND 1` | integrity |
| 16 | CHECK self-referencing `dependency_id <> task_id` | integrity |
| 17 | CHECK `expires_at > created_at` | integrity |
| 18 | CHECK `tokens >= 0` | integrity |
| 19 | `ON DELETE CASCADE` from `profiles.user_id` everywhere | delete behaviour |
| 20 | `ON DELETE CASCADE` for `action_items.meeting_id` | delete behaviour |
| 21 | `ON DELETE SET NULL` for optional parent references | delete behaviour |
| 22 | `UNIQUE (user_id, provider, external_id)` on `emails` | uniqueness |
| 23 | Partial `UNIQUE` on `calendar_events` where `external_id IS NOT NULL` | uniqueness |
| 24 | `UNIQUE (user_id, lower(email)) WHERE email IS NOT NULL` on `contacts` | uniqueness |
| 25 | `UNIQUE (user_id, category)` on `preferences` | uniqueness |
| 26 | `UNIQUE (user_id, provider)` on `integrations` | uniqueness |
| 27 | `UNIQUE (id, user_id)` on parents to enable composite FKs | uniqueness |
| 28 | Index set in §7 | performance |
| 29 | `GIST (tsrange(start,end))` for event overlap | performance |
| 30 | `tsvector` GIN indexes for search | performance |
| 31 | RLS enabled + `FORCE` on all tables | security |
| 32 | Scalar-subquery `auth.uid()` in policies | performance |
| 33 | Uniform per-row policies on `user_id` | security |
| 34 | Denormalised `user_id` on `action_items` (issue 7) — **APPROVED 2026-10-03** | security (issue 7) |
| 35 | Composite `(parent_id, user_id)` FKs against cross-tenant rows | security |
| 36 | `REVOKE` from `anon`, grant to `authenticated` | security |
| 37 | Audit log append-only for clients | security |
| 38 | `SECURITY DEFINER` RPCs for export/deletion, owned by `postgres` | security |
| 39 | No OAuth tokens in `integrations` | security |
| 40 | pgvector as a candidate, additive migration only if confirmed | AI |
| 41 | Hybrid full-text + vector retrieval | AI |
| 42 | `one_touch_templates` table (additive; §49 has no such entity) — required by §6 one-touch exception + §54 Action Authorization Layer | additive entity |
| 43 | Authorization decisions recorded in `audit_logs`; `block` → `result='denied'`, mode captured in `action` | security |
| 44 | One-touch `recipients` empty array permits nobody; no wildcard/permanent auto-send column | integrity |
| 45 | Provider credentials (OpenAI key, Google OAuth secret/tokens, DB credentials) come from environment variables, read server-side; never stored in the database and never hard-coded in source. The browser holds no secrets. Reinforces #39. | security |
| 46 | Google OAuth: the browser holds only non-secret config (`GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`, `GOOGLE_SERVICES`, `LIFEOS_MODE`). `GOOGLE_CLIENT_SECRET`, `GOOGLE_ACCESS_TOKEN`, `GOOGLE_REFRESH_TOKEN` are server-side only — never in `window`, HTML, `localStorage`, or `sessionStorage`. The authorization-code exchange is performed by a controlled backend, never the browser. The browser holds no OAuth tokens. Reinforces #39 and #45. | security |
| 47 | `projects` table (additive; §49 omits Project, but §50's relationship chain, §7's Personal Context Graph core nodes, `Task.project_id` and `Document.project_id` all require it). RECONCILIATION ISSUE 1. **APPROVED 2026-10-03** by explicit user decision. Minimal field set only: project_id, user_id, workspace_id, name, status, importance, created_at. No members, goals, milestones, or deadlines. | additive entity (approved) |
| 48 | `transcripts` table (additive; §49 gives only `Meeting.transcript_reference`, but §50's chain lists Transcript as a node and DEMO BUILD SPEC requires editable transcripts). RECONCILIATION ISSUE 4. **APPROVED 2026-10-03** by explicit user decision. Columns: meeting_id (UNIQUE, FK → meetings ON DELETE CASCADE), content, updated_at. | additive entity (approved) |

---

## 13. Explicit non-goals for Phase 4

- No Gmail, Google Calendar, WhatsApp, or any live integration (`ROADMAP.md` Phase 6)
- No real AI provider calls (Phase 5)
- No SQLite, Docker, or WSL
- No credentials in source; environment variables only
- No mobile app, no workspaces beyond what issue 2 decides
- No claim that Phase 3 is closed — status remains *automated validation complete;
  five-user human validation outstanding*
