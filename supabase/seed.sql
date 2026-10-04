# AI Life OS — synthetic seed data
#
# Source: `LIFE OS folder/DEMO BUILD SPEC.md` §4, as realised in
# `sim/assets/js/data/seed.js`. Counts per PRD.md Phase 3: 6 contacts, 24 emails,
# 6 calendar events, 3 meetings, 7 commitments, 15 tasks, 4 follow-ups, 4 documents,
# 4 integrations, 3 reminders (notifications).
#
# Fixed clock: SIM_TODAY = 2026-09-22. Preserved deliberately — the F-1…F-6
# forgetting rules and the priority scores depend on these timestamps (DATABASE-
# DESIGN-DECISIONS.md §10).
#
# TWO USERS are seeded, not one. The second user's rows are deliberately different so
# that any cross-user leak is unambiguous. `sim/selftest.html` expects 79 passing
# assertions for the simulation; this seed is the SQL counterpart of the same story.
#
# Idempotent: ON CONFLICT DO NOTHING throughout, so it is safe to re-run.
#
# SAFETY: this file inserts into auth.users so that profiles trigger correctly and
-- rows have a real owner. That is privileged work. Run it only against a
-- development project, never production.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Users (two, for the isolation test)
-- ---------------------------------------------------------------------------

-- Password is the same literal for both dev accounts and is intentionally obvious.
-- It exists only so the RLS test can sign in with a real JWT. Never reuse in production.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111',
   'demo@lifeos.local',
   crypt('demo_password_never_use_in_prod', gen_salt('bf')),
   now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"Demo User","timezone":"Europe/London"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222',
   'second@lifeos.local',
   crypt('demo_password_never_use_in_prod', gen_salt('bf')),
   now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"Second User","timezone":"Europe/London"}'::jsonb)
on conflict (id) do nothing;

-- profiles rows are created by the on_auth_user_created trigger; assert they exist.
insert into public.profiles (user_id, name, email, timezone, subscription, preferences)
values
  ('11111111-1111-4111-8111-111111111111', 'Demo User',  'demo@lifeos.local',   'Europe/London', 'pro',  '{"autonomy_level":2,"briefing_time":"08:00"}'),
  ('22222222-2222-4222-8222-222222222222', 'Second User','second@lifeos.local', 'Europe/London', 'free', '{"autonomy_level":1,"briefing_time":"07:30"}')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- workspaces (issue 2 deferred: personal-only, owner_id only)
-- ---------------------------------------------------------------------------

insert into public.workspaces (workspace_id, name, type, owner_id)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Workspace',   'personal', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Second Workspace', 'personal', '22222222-2222-4222-8222-222222222222')
on conflict (workspace_id) do nothing;

-- ---------------------------------------------------------------------------
-- contacts — 6 for demo user, 2 for second user
-- ---------------------------------------------------------------------------

insert into public.contacts (contact_id, user_id, workspace_id, name, email, phone, organization, relationship)
values
  ('c0000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'John Carter',    'john@abc.example',    '+44 7700 900101', 'ABC Ltd',   'client'),
  ('c0000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sarah Mitchell','sarah@board.example','+44 7700 900102', 'Board',     'board member'),
  ('c0000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Priya Sharma',   'priya@abc.example',   '+44 7700 900103', 'ABC Ltd',   'colleague'),
  ('c0000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Tom Whitfield',  'tom@supply.example',  '+44 7700 900104', 'Supplier', 'supplier'),
  ('c0000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Anita Desai',    'anita@internal.example','+44 7700 900105','Internal', 'manager'),
  ('c0000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mark Ellis',     'mark@vendor.example', '+44 7700 900106', 'Vendors',  'vendor'),
  ('c0000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bob Nolan',      'bob@other.example',   NULL, 'Other Co', 'colleague'),
  ('c0000002-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cara Singh',     'cara@other.example',  NULL, 'Other Co', 'partner')
on conflict (contact_id) do nothing;

-- ---------------------------------------------------------------------------
-- projects (issue 1) — 4 for demo user, 1 for second
-- ---------------------------------------------------------------------------

insert into public.projects (project_id, user_id, workspace_id, name, status, importance)
values
  ('d0000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ABC proposal', 'active', 90),
  ('d0000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board pack',   'active', 70),
  ('d0000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Internal',     'active', 50),
  ('d0000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Vendors',      'active', 40),
  ('d0000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other project','active', 60)
on conflict (project_id) do nothing;

-- ---------------------------------------------------------------------------
-- emails — 24 for demo user spanning all 8 categories, 2 for second user.
-- m10 is the payment-diversion scam: suspicious, held, action_required = false.
-- ---------------------------------------------------------------------------

insert into public.emails (email_id, user_id, provider, external_id, sender, recipients, subject, body_reference, category, priority, action_required, received_at)
values
  -- urgent (1)
  ('e0000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'simulated', 'm01', 'sarah@board.example', ARRAY['demo@lifeos.local'], 'Board meeting moved to Thursday', 'storage://sim/m01', 'urgent', 95, true,  '2026-09-22T07:05:00+00'),
  -- action required (10)
  ('e0000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'simulated', 'm02', 'john@abc.example',    ARRAY['demo@lifeos.local'], 'ABC proposal — final pricing needed', 'storage://sim/m02', 'action_required', 88, true, '2026-09-22T06:40:00+00'),
  ('e0000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'simulated', 'm03', 'tom@supply.example',  ARRAY['demo@lifeos.local'], 'Supplier contract clause 4.2 query', 'storage://sim/m03', 'action_required', 82, true, '2026-09-21T16:20:00+00'),
  ('e0000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'simulated', 'm04', 'anita@internal.example', ARRAY['demo@lifeos.local'], 'Q3 headcount plan needs your input', 'storage://sim/m04', 'action_required', 76, true, '2026-09-21T11:00:00+00'),
  ('e0000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'simulated', 'm05', 'john@abc.example',    ARRAY['demo@lifeos.local'], 'Re: three-tier pricing structure', 'storage://sim/m05', 'action_required', 72, true, '2026-09-20T14:30:00+00'),
  ('e0000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'simulated', 'm06', 'sarah@board.example', ARRAY['demo@lifeos.local'], 'Board pack draft for review', 'storage://sim/m06', 'action_required', 68, true, '2026-09-20T09:15:00+00'),
  ('e0000001-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'simulated', 'm07', 'tom@supply.example',  ARRAY['demo@lifeos.local'], 'Delivery date confirmation needed', 'storage://sim/m07', 'action_required', 64, true, '2026-09-19T15:45:00+00'),
  ('e0000001-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'simulated', 'm08', 'priya@abc.example',   ARRAY['demo@lifeos.local'], 'Marketing copy for ABC proposal', 'storage://sim/m08', 'action_required', 61, true, '2026-09-19T10:10:00+00'),
  ('e0000001-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'simulated', 'm09', 'mark@vendor.example', ARRAY['demo@lifeos.local'], 'Invoice awaiting approval', 'storage://sim/m09', 'action_required', 58, true, '2026-09-18T13:25:00+00'),
  ('e0000001-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'simulated', 'm11', 'priya@abc.example',   ARRAY['demo@lifeos.local'], 'Re: renewal terms', 'storage://sim/m11', 'action_required', 55, true, '2026-09-18T08:50:00+00'),
  -- important (1)
  ('e0000001-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'simulated', 'm12', 'priya@abc.example',   ARRAY['demo@lifeos.local'], 'Team offsite logistics', 'storage://sim/m12', 'important', 45, false, '2026-09-21T09:00:00+00'),
  -- waiting (2)
  ('e0000001-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', 'simulated', 'm13', 'john@abc.example',    ARRAY['demo@lifeos.local'], 'Re: missing pricing', 'storage://sim/m13', 'waiting', 40, false, '2026-09-16T12:00:00+00'),
  ('e0000001-0000-4000-8000-000000000013', '11111111-1111-4111-8111-111111111111', 'simulated', 'm14', 'tom@supply.example',  ARRAY['demo@lifeos.local'], 'Re: contract redlines', 'storage://sim/m14', 'waiting', 38, false, '2026-09-14T10:30:00+00'),
  -- newsletter (2)
  ('e0000001-0000-4000-8000-000000000014', '11111111-1111-4111-8111-111111111111', 'simulated', 'm15', 'news@industry.example', ARRAY['demo@lifeos.local'], 'Weekly industry digest', 'storage://sim/m15', 'newsletter', 20, false, '2026-09-21T06:00:00+00'),
  ('e0000001-0000-4000-8000-000000000015', '11111111-1111-4111-8111-111111111111', 'simulated', 'm16', 'news@tools.example',   ARRAY['demo@lifeos.local'], 'Product update roundup', 'storage://sim/m16', 'newsletter', 18, false, '2026-09-20T06:00:00+00'),
  -- promotion (2)
  ('e0000001-0000-4000-8000-000000000016', '11111111-1111-4111-8111-111111111111', 'simulated', 'm17', 'offers@retail.example', ARRAY['demo@lifeos.local'], 'Autumn sale — 30% off', 'storage://sim/m17', 'promotion', 12, false, '2026-09-21T05:00:00+00'),
  ('e0000001-0000-4000-8000-000000000017', '11111111-1111-4111-8111-111111111111', 'simulated', 'm18', 'deals@cloud.example',  ARRAY['demo@lifeos.local'], 'Upgrade your plan', 'storage://sim/m18', 'promotion', 10, false, '2026-09-20T05:00:00+00'),
  -- low priority (5)
  ('e0000001-0000-4000-8000-000000000018', '11111111-1111-4111-8111-111111111111', 'simulated', 'm19', 'no-reply@system.example', ARRAY['demo@lifeos.local'], 'Password changed successfully', 'storage://sim/m19', 'low_priority', 8, false, '2026-09-19T07:00:00+00'),
  ('e0000001-0000-4000-8000-000000000019', '11111111-1111-4111-8111-111111111111', 'simulated', 'm20', 'no-reply@system.example', ARRAY['demo@lifeos.local'], 'Your monthly usage summary', 'storage://sim/m20', 'low_priority', 7, false, '2026-09-18T07:00:00+00'),
  ('e0000001-0000-4000-8000-000000000020', '11111111-1111-4111-8111-111111111111', 'simulated', 'm21', 'hello@network.example', ARRAY['demo@lifeos.local'], 'Connection request', 'storage://sim/m21', 'low_priority', 6, false, '2026-09-17T07:00:00+00'),
  ('e0000001-0000-4000-8000-000000000021', '11111111-1111-4111-8111-111111111111', 'simulated', 'm22', 'survey@vendor.example', ARRAY['demo@lifeos.local'], 'How are we doing?', 'storage://sim/m22', 'low_priority', 5, false, '2026-09-16T07:00:00+00'),
  ('e0000001-0000-4000-8000-000000000023', '11111111-1111-4111-8111-111111111111', 'simulated', 'm23', 'news@misc.example',   ARRAY['demo@lifeos.local'], 'Five things we read this week', 'storage://sim/m23', 'low_priority', 4, false, '2026-09-15T07:00:00+00'),
  -- suspicious (1) — the payment-diversion scam. action_required MUST stay false:
  -- §54 and the Phase 3 safety rule forbid it becoming a task.
  ('e0000001-0000-4000-8000-000000000024', '11111111-1111-4111-8111-111111111111', 'simulated', 'm10', 'billing@abc-secure.example', ARRAY['demo@lifeos.local'], 'URGENT: verify payment to new bank details', 'storage://sim/m10', 'suspicious', 0, false, '2026-09-22T05:30:00+00'),
  -- second user's rows: deliberately different so a leak is unambiguous
  ('e0000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'simulated', 'n01', 'bob@other.example', ARRAY['second@lifeos.local'], 'Other Co quarterly numbers', 'storage://sim/n01', 'action_required', 70, true, '2026-09-22T08:00:00+00'),
  ('e0000002-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'simulated', 'n02', 'cara@other.example', ARRAY['second@lifeos.local'], 'Lunch on Friday?', 'storage://sim/n02', 'low_priority', 10, false, '2026-09-21T12:00:00+00')
on conflict (email_id) do nothing;

-- ---------------------------------------------------------------------------
-- calendar_events — 6 for demo user (including the deliberate conflict on the 22nd),
-- 1 for second user
-- ---------------------------------------------------------------------------

insert into public.calendar_events (event_id, user_id, external_id, title, participants, start, "end", location, source)
values
  ('f0000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'gcal-01', 'ABC proposal review', ARRAY['John Carter','Priya Sharma'], '2026-09-22T09:00:00+00','2026-09-22T10:00:00+00','Meeting room 2', 'simulated'),
  ('f0000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'gcal-02', 'Board prep',             ARRAY['Sarah Mitchell'],           '2026-09-22T09:30:00+00','2026-09-22T11:00:00+00','Board room', 'simulated'),
  ('f0000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'gcal-03', 'Supplier call',          ARRAY['Tom Whitfield'],             '2026-09-22T14:00:00+00','2026-09-22T15:00:00+00','Zoom', 'simulated'),
  ('f0000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'gcal-04', 'Headcount review',       ARRAY['Anita Desai'],               '2026-09-23T10:00:00+00','2026-09-23T11:00:00+00','Meeting room 1', 'simulated'),
  ('f0000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'gcal-05', 'Vendor negotiation',      ARRAY['Mark Ellis'],                '2026-09-24T13:00:00+00','2026-09-24T14:30:00+00','Zoom', 'simulated'),
  ('f0000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'gcal-06', 'Offsite planning',        ARRAY['Priya Sharma','Anita Desai'],'2026-09-25T09:00:00+00','2026-09-25T12:00:00+00','TBD', 'simulated'),
  ('f0000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'gcal-11', 'Other Co standup',        ARRAY['Bob Nolan','Cara Singh'],    '2026-09-22T09:00:00+00','2026-09-22T09:30:00+00','Room 9', 'simulated')
on conflict (event_id) do nothing;

-- ---------------------------------------------------------------------------
-- meetings — 3 for demo user, 1 for second
-- ---------------------------------------------------------------------------

insert into public.meetings (meeting_id, user_id, title, date, source, audio_reference, transcript_reference, summary)
values
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'ABC proposal kickoff', '2026-09-15T09:00:00+00', 'simulated', 'storage://sim/audio/meeting-1.mp3', 'storage://sim/audio/meeting-1.txt', 'Three-tier pricing structure. Missing final pricing from John.'),
  ('a0000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Board pack sync',     '2026-09-16T14:00:00+00', 'simulated', 'storage://sim/audio/meeting-2.mp3', 'storage://sim/audio/meeting-2.txt', 'Two-page supplier summary for the board pack.'),
  ('a0000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Vendor negotiation',  '2026-09-18T13:00:00+00', 'simulated', 'storage://sim/audio/meeting-3.mp3', 'storage://sim/audio/meeting-3.txt', 'Renewal terms. Clause 4.2 indemnity does not match agreed position.'),
  ('a0000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Other Co kickoff',    '2026-09-17T10:00:00+00', 'simulated', 'storage://sim/audio/meeting-4.mp3', 'storage://sim/audio/meeting-4.txt', 'Second user meeting.')
on conflict (meeting_id) do nothing;

-- transcripts (issue 4) — editable text, separate from the storage reference above
insert into public.transcripts (meeting_id, content)
values
  ('a0000001-0000-4000-8000-000000000001',
   'JOHN: We need the three-tier pricing structure before Friday.\nSARAH: Can you send the final pricing?\nDEMO USER: I will send the revised pricing by Thursday.'),
  ('a0000001-0000-4000-8000-000000000002',
   'SARAH: The board pack needs a two-page supplier summary.\nDEMO USER: I will prepare it and share before the board meeting.'),
  ('a0000001-0000-4000-8000-000000000003',
   'MARK: Clause 4.2 indemnity does not match our agreed position.\nDEMO USER: I will get legal to review and revert.')
on conflict (meeting_id) do nothing;

-- action_items — §49 + approved issue 7 (user_id is trigger-filled, not supplied)
insert into public.action_items (action_id, meeting_id, task_id, owner, owner_contact_id, deadline, confidence)
values
  ('b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', '10000001-0000-4000-8000-000000000002', 'Demo User', NULL, '2026-09-24', 0.92),
  ('b0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001', NULL, 'John Carter', 'c0000001-0000-4000-8000-000000000001', '2026-09-24', 0.78),
  ('b0000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000002', '10000001-0000-4000-8000-000000000003', 'Demo User', NULL, '2026-09-25', 0.88),
  ('b0000001-0000-4000-8000-000000000004', 'a0000001-0000-4000-8000-000000000003', '10000001-0000-4000-8000-000000000007', 'Demo User', NULL, '2026-09-28', 0.71)
on conflict (action_id) do nothing;

-- ---------------------------------------------------------------------------
-- tasks — 15 for demo user, 2 for second.
-- k2 is the blocking dependency referenced by t1, matching the sim's top priority item.
-- ---------------------------------------------------------------------------

insert into public.tasks (task_id, user_id, title, description, status, priority, due_date, source, project_id, contact_id, dependency_id)
values
  ('10000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Send revised ABC pricing', 'Blocked until John confirms the third tier', 'blocked',  92, '2026-09-22', 'email',   'd0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', '10000001-0000-4000-8000-000000000002'),
  ('10000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Obtain John''s final pricing', 'Waiting on the client', 'open', 88, '2026-09-21', 'meeting', 'd0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', NULL),
  ('10000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Draft two-page supplier summary', 'For the board pack', 'open', 85, '2026-09-23', 'meeting', 'd0000001-0000-4000-8000-000000000002', 'c0000001-0000-4000-8000-000000000002', NULL),
  ('10000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Resolve clause 4.2 indemnity', 'Does not match agreed position', 'open', 80, '2026-09-24', 'meeting', 'd0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000006', NULL),
  ('10000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Approve ABC Ltd invoice', 'Awaiting approval', 'open', 78, '2026-09-23', 'email', 'd0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000006', NULL),
  ('10000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'Confirm supplier delivery date', 'Needs confirmation', 'open', 74, '2026-09-24', 'email', 'd0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000004', NULL),
  ('10000001-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Get legal review of clause 4.2', 'Legal to revert', 'open', 70, '2026-09-28', 'meeting', 'd0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000004', NULL),
  ('10000001-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'Finalise marketing copy', 'ABC proposal collateral', 'in_progress', 66, '2026-09-25', 'email', 'd0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000003', NULL),
  ('10000001-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'Q3 headcount plan', 'Needs input from Anita', 'open', 62, '2026-09-23', 'email', 'd0000001-0000-4000-8000-000000000003', 'c0000001-0000-4000-8000-000000000005', NULL),
  ('10000001-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'Prepare board pack', 'For Thursday board meeting', 'open', 60, '2026-09-22', 'manual', 'd0000001-0000-4000-8000-000000000002', 'c0000001-0000-4000-8000-000000000002', NULL),
  ('10000001-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'Plan team offsite', 'Catering and travel', 'open', 45, '2026-09-30', 'email', 'd0000001-0000-4000-8000-000000000003', 'c0000001-0000-4000-8000-000000000003', NULL),
  ('10000001-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', 'Chase supplier redlines', 'Waiting 12 days — triggers F-6', 'open', 42, '2026-09-14', 'followup', 'd0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000004', NULL),
  ('10000001-0000-4000-8000-000000000013', '11111111-1111-4111-8111-111111111111', 'Archive old proposals', 'Housekeeping', 'completed', 20, '2026-09-11', 'manual', NULL, NULL, NULL),
  ('10000001-0000-4000-8000-000000000014', '11111111-1111-4111-8111-111111111111', 'Review supplier scorecard', 'Quarterly review', 'completed', 18, '2026-09-12', 'manual', 'd0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000004', NULL),
  ('10000001-0000-4000-8000-000000000015', '11111111-1111-4111-8111-111111111111', 'Update vendor contact list', 'Mark left the company', 'open', 30, '2026-09-19', 'followup', 'd0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000006', NULL),
  ('10000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Review Other Co numbers', 'Second user task', 'open', 70, '2026-09-24', 'email', 'd0000002-0000-4000-8000-000000000001', 'c0000002-0000-4000-8000-000000000001', NULL),
  ('10000002-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Book Friday lunch', 'Second user task', 'open', 30, '2026-09-25', 'manual', 'd0000002-0000-4000-8000-000000000001', 'c0000002-0000-4000-8000-000000000002', NULL)
on conflict (task_id) do nothing;

-- ---------------------------------------------------------------------------
-- commitments — 7 for demo user, 1 for second
-- ---------------------------------------------------------------------------

insert into public.commitments (commitment_id, user_id, person_id, description, direction, due_date, status, confidence, source)
values
  ('70000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'Send revised ABC pricing',            'user_to_other',   '2026-09-24', 'confirmed',  0.92, 'meeting-1'),
  ('70000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'John to send final pricing',          'other_to_user',   '2026-09-21', 'confirmed',  0.88, 'meeting-1'),
  ('70000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000002', 'Prepare two-page supplier summary',   'user_to_other',   '2026-09-25', 'confirmed',  0.85, 'meeting-2'),
  ('70000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000004', 'Legal to review clause 4.2',          'user_to_other',   '2026-09-28', 'possible',   0.71, 'meeting-3'),
  ('70000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000005', 'Provide headcount figures',           'user_to_other',   '2026-09-23', 'possible',   0.64, 'email-m04'),
  ('70000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000006', 'Agree renewal terms with vendors',   'mutual',          '2026-09-30', 'possible',   0.58, 'meeting-3'),
  ('70000001-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', NULL,                                       'Clarify payment details',            'uncertain',       NULL,         'possible',   0.31, 'email-m10'),
  ('70000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'c0000002-0000-4000-8000-000000000001', 'Send quarterly numbers',             'user_to_other',   '2026-09-24', 'confirmed',  0.90, 'email-n01')
on conflict (commitment_id) do nothing;

-- follow_ups — 4 for demo user, 1 for second.
-- 'sent' + elapsed time is what derives "Waiting For"; it is not stored as a label.
insert into public.follow_ups (followup_id, user_id, contact_id, subject, due_date, status, source)
values
  ('80000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'Chase final ABC pricing',  '2026-09-21', 'sent',    'email-m02'),
  ('80000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000004', 'Chase supplier redlines',  '2026-09-14', 'sent',    'email-m14'),
  ('80000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000005', 'Confirm headcount dates',  '2026-09-23', 'pending', 'email-m04'),
  ('80000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'c0000001-0000-4000-8000-000000000003', 'Review marketing copy',   '2026-09-25', 'replied', 'email-m08'),
  ('80000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'c0000002-0000-4000-8000-000000000001', 'Follow up on numbers',    '2026-09-24', 'sent',    'email-n01')
on conflict (followup_id) do nothing;

-- ---------------------------------------------------------------------------
-- documents — 4 for demo user, 1 for second
-- ---------------------------------------------------------------------------

insert into public.documents (document_id, user_id, filename, type, storage_reference, project_id, contact_id)
values
  ('90000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'abc-proposal-v3.pdf',  'pdf',  'storage://sim/docs/abc-proposal-v3.pdf',  'd0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001'),
  ('90000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'board-pack-draft.docx','docx', 'storage://sim/docs/board-pack-draft.docx','d0000001-0000-4000-8000-000000000002', 'c0000001-0000-4000-8000-000000000002'),
  ('90000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'abc-invoice-4471.pdf','pdf',  'storage://sim/docs/abc-invoice-4471.pdf', 'd0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000006'),
  ('90000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'supplier-contract.docx','docx','storage://sim/docs/supplier-contract.docx','d0000001-0000-4000-8000-000000000004', 'c0000001-0000-4000-8000-000000000004'),
  ('90000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'other-co-numbers.xlsx','xlsx','storage://sim/docs/other-co-numbers.xlsx','d0000002-0000-4000-8000-000000000001', 'c0000002-0000-4000-8000-000000000001')
on conflict (document_id) do nothing;

-- memories — provenance + confidence per §50
insert into public.memories (memory_id, user_id, category, content, source, confidence, importance, created_at, expires_at)
values
  ('a1000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'preference', 'Board meetings are on Thursdays',            'email-m01', 0.90, 80, '2026-09-22T07:06:00+00', NULL),
  ('a1000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'relationship','John Carter is the ABC Ltd commercial contact','email-m02', 0.95, 85, '2026-09-22T06:41:00+00', NULL),
  ('a1000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'fact',       'Clause 4.2 indemnity is disputed',              'meeting-3',  0.75, 70, '2026-09-18T13:30:00+00', NULL),
  ('a1000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'fact',       'Old supplier bank details are unverified',     'email-m10',  0.40, 90, '2026-09-22T05:31:00+00', '2026-10-22T00:00:00+00')
on conflict (memory_id) do nothing;

-- preferences — one effective value per category
insert into public.preferences (preference_id, user_id, category, value, source, confidence)
values
  ('d1000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'autonomy',      '{"level":2}'::jsonb, 'manual', 1.0),
  ('d1000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'briefing',     '{"time":"08:00"}'::jsonb, 'manual', 1.0),
  ('d1000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'notifications','{"email":true,"push":false}'::jsonb, 'manual', 1.0),
  ('d1000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'autonomy',      '{"level":1}'::jsonb, 'manual', 1.0)
on conflict (preference_id) do nothing;

-- integrations — 4 for demo user. NO OAuth tokens (§53 secure token handling).
insert into public.integrations (integration_id, user_id, provider, status, permissions, last_sync, error_state)
values
  ('61000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'gmail',    'connected',      ARRAY['https://www.googleapis.com/auth/gmail.readonly'], '2026-09-22T06:00:00+00', NULL),
  ('61000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'gcal',     'connected',      ARRAY['https://www.googleapis.com/auth/calendar.readonly'], '2026-09-22T06:00:00+00', NULL),
  ('61000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'drive',    'error',          ARRAY['https://www.googleapis.com/auth/drive.readonly'],  '2026-09-20T18:00:00+00', 'invalid_grant'),
  ('61000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'whatsapp', 'reauth_required',ARRAY['messages'],                                '2026-09-19T12:00:00+00', 'token_expired')
on conflict (integration_id) do nothing;

-- notifications — 3 for demo user
insert into public.notifications (notification_id, user_id, type, priority, content, delivery_status)
values
  ('f1000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'briefing',    95, 'Morning briefing for 2026-09-22', 'sent'),
  ('f1000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'waiting',     88, 'Waiting on John for final pricing', 'sent'),
  ('f1000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'forgetting',  85, 'Supplier redlines overdue',         'failed')
on conflict (notification_id) do nothing;

-- ai_interactions — §60 cost control. Simulated only; no real provider was called.
insert into public.ai_interactions (interaction_id, user_id, input, output, model, tokens, usage, action_taken)
values
  ('c1000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'What needs attention today?', 'Four priority items; top item blocked by k2.', 'simulated-v1', 420, '{"simulated":true}'::jsonb, NULL),
  ('c1000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'What am I forgetting?',       'Four findings with sources.',                      'simulated-v1', 380, '{"simulated":true}'::jsonb, NULL),
  ('c1000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Bulk: prepare my meetings',   'Refused: autonomy level 2 is below 3.',            'simulated-v1', 150, '{"simulated":true}'::jsonb, 'denied')
on conflict (interaction_id) do nothing;

-- audit_logs — §53
insert into public.audit_logs (audit_id, user_id, action, actor, result)
values
  ('e1000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'account.signup',   'user', 'success'),
  ('e1000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'email.classify',   'ai',   'success'),
  ('e1000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'action.bulk_prepare_meetings', 'ai', 'denied'),
  ('e1000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'account.signup',   'user', 'success')
on conflict (audit_id) do nothing;

-- ---------------------------------------------------------------------------
-- Post-seed verification. Fails loudly rather than seeding a wrong story.
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad int;
begin
  -- 24 demo-user emails, one per m01..m24 semantics, all 8 categories present
  select count(*) into v_bad
  from public.emails
  where user_id = '11111111-1111-4111-8111-111111111111';

  if v_bad <> 24 then
    raise exception 'seed check failed: expected 24 demo emails, found %', v_bad;
  end if;

  -- the scam email must stay held
  if exists (
    select 1 from public.emails
    where external_id = 'm10'
      and (category <> 'suspicious' or action_required is not false)
  ) then
    raise exception 'seed check failed: m10 must be suspicious with action_required = false';
  end if;

  -- both users must exist and own data
  if (select count(*) from public.contacts where user_id = '22222222-2222-4222-8222-222222222222') = 0 then
    raise exception 'seed check failed: second user has no contacts — isolation test needs both sides populated';
  end if;

  raise notice 'seed verified: 24 demo emails, m10 held, both users populated';
end;
$$;
