-- AI Life OS — migrations
--
-- Target: hosted PostgreSQL (Supabase Cloud). Apply with the Supabase CLI (`supabase db push`)
-- or by running each file in filename order against the connection string in
-- `SUPABASE_DB_URL` (environment variable only — never commit it).
--
-- Source of truth: `LIFE OS folder/LIFE OS PROJECT.md` §49 (entities), §50 (relationships),
-- §53 (security). Every non-spec detail is a DERIVED decision recorded in
-- `DATABASE-DESIGN-DECISIONS.md`.
--
-- Reconciliation issues:
--   1 — `projects` table added — APPROVED 2026-10-03 (additive; §49 references it via task/document project_id)
--   4 — `transcripts` table added — APPROVED 2026-10-03 (§50 chain node; §49 has only a storage reference)
--   7 — `action_items.user_id` added — APPROVED 2026-10-03 (denormalised, trigger-maintained, for RLS)
--   2 — workspace membership DEFERRED; workspaces are personal-only in the MVP

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- gen_random_uuid() lives in pgcrypto on older Postgres; Supabase ships it.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. profiles  (§49 User)
--    Renamed from `users` to avoid collision with Supabase's built-in auth.users.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  name         text        not null,
  email        text        not null unique,
  timezone     text        not null default 'Europe/London',
  subscription text        not null default 'free',
  preferences  jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint profiles_subscription_check
    check (subscription in ('free', 'pro', 'lifetime'))
);

comment on table public.profiles is '§49 User. 1:1 with auth.users.';

-- ---------------------------------------------------------------------------
-- 2. workspaces  (§49 Workspace) — personal-only; issue 2 deferred
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  workspace_id uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null default 'personal',
  owner_id     uuid not null references public.profiles(user_id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint workspaces_type_check check (type in ('personal', 'work', 'shared', 'team')),
  constraint workspaces_id_owner_key unique (workspace_id, owner_id)
);

comment on table public.workspaces is
  '§49 Workspace. Issue 2 (membership) deferred: only owner_id has RLS. shared/team types are reserved.';

-- ---------------------------------------------------------------------------
-- 3. contacts  (§49 Contact)
-- ---------------------------------------------------------------------------

create table if not exists public.contacts (
  contact_id   uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(user_id) on delete cascade,
  workspace_id uuid references public.workspaces(workspace_id) on delete set null,
  name         text not null,
  email        text,
  phone        text,
  organization text,
  relationship text,
  created_at   timestamptz not null default now()
);

comment on table public.contacts is '§49 Contact. Person ≡ Contact throughout (issue 5).';

-- ---------------------------------------------------------------------------
-- 4. projects  (RECONCILIATION ISSUE 1 — additive)
--    §49 does not define Project, but tasks.project_id, documents.project_id and the
--    §50 Context Engine chain all require it.
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  project_id   uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(user_id) on delete cascade,
  workspace_id uuid references public.workspaces(workspace_id) on delete set null,
  name         text        not null,
  status       text,
  importance   integer,
  created_at   timestamptz not null default now(),
  constraint projects_importance_check
    check (importance is null or importance between 0 and 100),
  constraint projects_id_user_key unique (project_id, user_id)
);

comment on table public.projects is
  'RECONCILIATION ISSUE 1. Additive table required by tasks.project_id, documents.project_id and §50. Minimal by design: no members, goals or deadlines, because §49 defines none.';

-- ---------------------------------------------------------------------------
-- 5. emails  (§49 Email)
-- ---------------------------------------------------------------------------

create table if not exists public.emails (
  email_id        uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  provider        text        not null,
  external_id     text        not null,
  sender          text        not null,
  recipients      text[]      not null default '{}',
  subject         text        not null,
  body_reference  text        not null,
  category        text        not null,
  priority        integer     not null default 0,
  action_required boolean     not null default false,
  received_at     timestamptz not null,
  constraint emails_category_check check (category in
    ('urgent', 'action_required', 'important', 'waiting', 'newsletter',
     'promotion', 'low_priority', 'suspicious')),
  constraint emails_priority_check check (priority between 0 and 100),
  constraint emails_idempotency_key unique (user_id, provider, external_id)
);

comment on table public.emails is
  '§49 Email. unique(user_id, provider, external_id) makes Gmail re-sync idempotent (§61, Phase 6).';

-- ---------------------------------------------------------------------------
-- 6. calendar_events  (§49 Calendar Event)
-- ---------------------------------------------------------------------------

create table if not exists public.calendar_events (
  event_id    uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  external_id text,
  title       text        not null,
  participants text[]     not null default '{}',
  start       timestamptz not null,
  "end"       timestamptz not null,
  location    text,
  source      text        not null default 'manual',
  constraint calendar_events_end_after_start_check check ("end" > start),
  constraint calendar_events_source_check
    check (source in ('google', 'simulated', 'manual', 'import')),
  constraint calendar_events_idempotency_key
    unique (user_id, source, external_id)
);

comment on table public.calendar_events is
  '§49 Calendar Event. "end" is quoted because END is a SQL keyword. external_id nullable: simulated events have none.';

-- ---------------------------------------------------------------------------
-- 7. tasks  (§49 Task)
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  task_id       uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(user_id) on delete cascade,
  title         text        not null,
  description   text,
  status        text        not null default 'open',
  priority      integer     not null default 0,
  due_date      date,
  source        text        not null,
  project_id    uuid references public.projects(project_id) on delete set null,
  contact_id    uuid references public.contacts(contact_id) on delete set null,
  dependency_id uuid references public.tasks(task_id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint tasks_priority_check check (priority between 0 and 100),
  constraint tasks_status_check
    check (status in ('open', 'in_progress', 'blocked', 'completed', 'cancelled', 'deferred')),
  constraint tasks_source_check
    check (source in ('email', 'meeting', 'manual', 'followup', 'ai_suggested')),
  constraint tasks_no_self_dependency check (dependency_id is null or dependency_id <> task_id),
  constraint tasks_id_user_key unique (task_id, user_id)
);

comment on table public.tasks is
  '§49 Task. source includes ai_suggested because §54 requires AI proposals to carry durable provenance.';

-- ---------------------------------------------------------------------------
-- 8. meetings  (§49 Meeting)
-- ---------------------------------------------------------------------------

create table if not exists public.meetings (
  meeting_id          uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(user_id) on delete cascade,
  title               text        not null,
  date                timestamptz not null,
  source              text        not null default 'manual',
  audio_reference     text,
  transcript_reference text,
  summary             text,
  constraint meetings_source_check check (source in ('manual', 'simulated', 'upload', 'google')),
  constraint meetings_id_user_key unique (meeting_id, user_id)
);

comment on table public.meetings is
  '§49 Meeting. transcript_reference points at stored media; editable text lives in transcripts (issue 4).';

-- ---------------------------------------------------------------------------
-- 9. transcripts  (RECONCILIATION ISSUE 4 — additive)
--    §50 lists Transcript as a chain node and the MVP spec requires editable
--    transcripts; a storage reference cannot be edited.
-- ---------------------------------------------------------------------------

create table if not exists public.transcripts (
  transcript_id uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null unique references public.meetings(meeting_id) on delete cascade,
  content       text not null default '',
  updated_at    timestamptz not null default now()
);

comment on table public.transcripts is
  'RECONCILIATION ISSUE 4. One editable transcript per meeting; meetings.transcript_reference still holds the stored file.';

-- ---------------------------------------------------------------------------
-- 10. action_items  (§49 Action Item + APPROVED ISSUE 7 user_id)
-- ---------------------------------------------------------------------------

create table if not exists public.action_items (
  action_id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(meeting_id) on delete cascade,
  task_id    uuid references public.tasks(task_id) on delete set null,
  owner      text        not null,
  owner_contact_id uuid references public.contacts(contact_id) on delete set null,
  deadline   date,
  confidence numeric(4,3) not null default 1.0,
  created_at timestamptz not null default now(),
  constraint action_items_confidence_check check (confidence between 0 and 1),
  constraint action_items_id_user_key unique (action_id, user_id),
  -- APPROVED ISSUE 7: §49 omits user_id, but §53 requires per-row isolation.
  -- Maintained from meetings by the trigger below so it can never drift.
  user_id uuid not null references public.profiles(user_id) on delete cascade
);

comment on table public.action_items is
  '§49 Action Item + approved issue 7. user_id is denormalised from meetings.user_id and trigger-maintained, so RLS needs no join.';

create or replace function public.sync_action_items_user_id()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.meeting_id is distinct from old.meeting_id then
    select m.user_id into new.user_id
    from public.meetings m
    where m.meeting_id = new.meeting_id;
    if new.user_id is null then
      raise exception 'action_items.meeting_id % does not belong to an existing meeting', new.meeting_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger action_items_sync_user_id
before insert or update of meeting_id on public.action_items
for each row execute function public.sync_action_items_user_id();

-- Composite FK: an action item can only reference a task owned by the same user.
-- (The issue-7 column makes this redundant for meetings, but keeps the invariant
--  enforced even if the denormalisation is ever removed.)
alter table public.action_items
  drop constraint if exists action_items_meeting_user_fkey;
alter table public.action_items
  add constraint action_items_meeting_user_fkey
  foreign key (meeting_id, user_id)
  references public.meetings (meeting_id, user_id)
  on delete cascade;

-- ---------------------------------------------------------------------------
-- 11. commitments  (§49 Commitment) — column name kept verbatim per issue 5
-- ---------------------------------------------------------------------------

create table if not exists public.commitments (
  commitment_id uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(user_id) on delete cascade,
  person_id    uuid references public.contacts(contact_id) on delete set null,
  description  text        not null,
  direction    text        not null,
  due_date     date,
  status       text        not null default 'possible',
  confidence   numeric(4,3) not null default 0.5,
  source       text        not null,
  created_at   timestamptz not null default now(),
  constraint commitments_direction_check
    check (direction in ('user_to_other', 'other_to_user', 'mutual', 'uncertain')),
  constraint commitments_status_check
    check (status in ('possible', 'confirmed', 'declined', 'fulfilled', 'cancelled')),
  constraint commitments_confidence_check check (confidence between 0 and 1)
);

comment on table public.commitments is
  '§49 Commitment. person_id is §49''s column name verbatim, but references contacts (issue 5: Person ≡ Contact). direction values match ROADMAP.md Phase 5.';

-- ---------------------------------------------------------------------------
-- 12. follow_ups  (§49 Follow-Up) — Waiting For is DERIVED, not stored (issue 8)
-- ---------------------------------------------------------------------------

create table if not exists public.follow_ups (
  followup_id uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  contact_id  uuid not null references public.contacts(contact_id) on delete set null,
  subject     text        not null,
  due_date    date,
  status      text        not null default 'pending',
  source      text        not null,
  created_at  timestamptz not null default now(),
  constraint follow_ups_status_check
    check (status in ('pending', 'sent', 'replied', 'closed'))
);

comment on table public.follow_ups is
  '§49 Follow-Up. status is the communication state only. "Waiting For" is derived (status=''sent'' plus elapsed time), per ROADMAP.md Phase 3.';

-- ---------------------------------------------------------------------------
-- 13. documents  (§49 Document)
-- ---------------------------------------------------------------------------

create table if not exists public.documents (
  document_id      uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(user_id) on delete cascade,
  filename         text        not null,
  type             text        not null,
  storage_reference text       not null,
  project_id       uuid references public.projects(project_id) on delete set null,
  contact_id       uuid references public.contacts(contact_id) on delete set null,
  created_at       timestamptz not null default now()
);

comment on table public.documents is '§49 Document. Content is in storage, not inline (§59 privacy).';

-- ---------------------------------------------------------------------------
-- 14. memories  (§49 Memory)
-- ---------------------------------------------------------------------------

create table if not exists public.memories (
  memory_id  uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(user_id) on delete cascade,
  category   text        not null,
  content    text        not null,
  source     text        not null,
  confidence numeric(4,3) not null default 0.5,
  importance integer     not null default 50,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint memories_confidence_check check (confidence between 0 and 1),
  constraint memories_importance_check check (importance between 0 and 100),
  constraint memories_expiry_after_creation_check
    check (expires_at is null or expires_at > created_at)
);

comment on table public.memories is '§49 Memory. expires_at implements §59 retention; the forgetting sweep (F-rules) filters on it.';

-- ---------------------------------------------------------------------------
-- 15. preferences  (§49 Preference)
-- ---------------------------------------------------------------------------

create table if not exists public.preferences (
  preference_id uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(user_id) on delete cascade,
  category      text        not null,
  value         jsonb       not null,
  source        text        not null,
  confidence    numeric(4,3) not null default 1.0,
  updated_at    timestamptz not null default now(),
  constraint preferences_confidence_check check (confidence between 0 and 1),
  constraint preferences_user_category_key unique (user_id, category)
);

comment on table public.preferences is
  '§49 Preference. unique(user_id, category) means correction learning (ROADMAP.md Phase 5) updates a row instead of creating conflicting duplicates.';

-- ---------------------------------------------------------------------------
-- 16. integrations  (§49 Integration) — OAuth tokens deliberately NOT here
-- ---------------------------------------------------------------------------

create table if not exists public.integrations (
  integration_id uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(user_id) on delete cascade,
  provider       text        not null,
  status         text        not null default 'disconnected',
  permissions    text[]      not null default '{}',
  last_sync      timestamptz,
  error_state    text,
  constraint integrations_status_check
    check (status in ('connected', 'disconnected', 'error', 'reauth_required')),
  constraint integrations_user_provider_key unique (user_id, provider)
);

comment on table public.integrations is
  '§49 Integration. Deliberately holds NO OAuth tokens: §53 requires secure token handling, and refresh tokens behind this table''s user-scoped RLS would be ordinary data. Tokens live in Supabase-managed server storage.';

-- ---------------------------------------------------------------------------
-- 17. notifications  (§49 Notification)
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  notification_id  uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(user_id) on delete cascade,
  type             text        not null,
  priority         integer     not null default 0,
  content          text        not null,
  delivery_status  text        not null default 'pending',
  created_at       timestamptz not null default now(),
  constraint notifications_priority_check check (priority between 0 and 100),
  constraint notifications_delivery_check
    check (delivery_status in ('pending', 'sent', 'failed', 'read'))
);

comment on table public.notifications is
  '§49 Notification. delivery_status includes failed because §55 requires every external process to expose a failure state.';

-- ---------------------------------------------------------------------------
-- 18. ai_interactions  (§49 AI Interaction) — §60 cost control
-- ---------------------------------------------------------------------------

create table if not exists public.ai_interactions (
  interaction_id uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(user_id) on delete cascade,
  input          text        not null,
  output         text        not null,
  model          text        not null,
  tokens         integer     not null default 0,
  usage          jsonb,
  timestamp      timestamptz not null default now(),
  action_taken   text,
  constraint ai_interactions_tokens_check check (tokens >= 0)
);

comment on table public.ai_interactions is
  '§49 AI Interaction. input/output are NOT NULL: a refusal is still an output, and an unlogged attempt would defeat §60 cost control.';

-- ---------------------------------------------------------------------------
-- 19. audit_logs  (§49 Audit Log) — append-only for clients
-- ---------------------------------------------------------------------------

create table if not exists public.audit_logs (
  audit_id  uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(user_id) on delete cascade,
  action    text        not null,
  actor     text        not null,
  timestamp timestamptz not null default now(),
  result    text        not null,
  constraint audit_logs_result_check check (result in ('success', 'failure', 'denied'))
);

comment on table public.audit_logs is
  '§49 Audit Log. result includes denied because §54 makes a blocked autonomous action a security event. Clients get INSERT/SELECT only; UPDATE and DELETE are never granted.';
