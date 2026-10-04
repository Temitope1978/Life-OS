# AI Life OS — indexes
# Derived decisions 28–30 in DATABASE-DESIGN-DECISIONS.md §7.
# Every RLS predicate filters on user_id, so those indexes are the hottest path in
# the system. Composite indexes are ordered (user_id, …) so they serve both RLS and
# the Phase 5 engine queries.

-- --- isolation-critical: user_id on every table ---
create index if not exists idx_workspaces_owner_id      on public.workspaces (owner_id);

create index if not exists idx_contacts_user_id         on public.contacts (user_id);
create index if not exists idx_projects_user_id         on public.projects (user_id);
create index if not exists idx_emails_user_id           on public.emails (user_id);
create index if not exists idx_calendar_events_user_id  on public.calendar_events (user_id);
create index if not exists idx_tasks_user_id            on public.tasks (user_id);
create index if not exists idx_meetings_user_id         on public.meetings (user_id);
create index if not exists idx_action_items_user_id     on public.action_items (user_id);
create index if not exists idx_commitments_user_id      on public.commitments (user_id);
create index if not exists idx_follow_ups_user_id       on public.follow_ups (user_id);
create index if not exists idx_documents_user_id        on public.documents (user_id);
create index if not exists idx_memories_user_id         on public.memories (user_id);
create index if not exists idx_preferences_user_id      on public.preferences (user_id);
create index if not exists idx_integrations_user_id     on public.integrations (user_id);
create index if not exists idx_notifications_user_id    on public.notifications (user_id);
create index if not exists idx_ai_interactions_user_id  on public.ai_interactions (user_id);
create index if not exists idx_audit_logs_user_id       on public.audit_logs (user_id);

-- --- My Day / Command Center: "what needs attention today" ---
create index if not exists idx_tasks_user_status_due    on public.tasks (user_id, status, due_date);
create index if not exists idx_tasks_user_priority      on public.tasks (user_id, priority desc);

-- Blocked-task detection: the sim explains its top item as blocked by k2.
create index if not exists idx_tasks_user_dependency
  on public.tasks (user_id, dependency_id)
  where dependency_id is not null;

create index if not exists idx_tasks_user_contact        on public.tasks (user_id, contact_id);
create index if not exists idx_tasks_user_project        on public.tasks (user_id, project_id);

-- --- "What did I promise?" ---
create index if not exists idx_commitments_user_status_due
  on public.commitments (user_id, status, due_date);
create index if not exists idx_commitments_user_direction
  on public.commitments (user_id, direction);
create index if not exists idx_commitments_user_person   on public.commitments (user_id, person_id);

-- --- "Who am I waiting for?" ---
create index if not exists idx_follow_ups_user_status_due
  on public.follow_ups (user_id, status, due_date);
create index if not exists idx_follow_ups_user_contact   on public.follow_ups (user_id, contact_id);

-- --- Inbox ---
create index if not exists idx_emails_user_received     on public.emails (user_id, received_at desc);
create index if not exists idx_emails_user_category     on public.emails (user_id, category, received_at desc);

-- --- Calendar ---
create index if not exists idx_calendar_events_user_range
  on public.calendar_events (user_id, start, "end");

-- --- Meetings ---
create index if not exists idx_meetings_user_date       on public.meetings (user_id, date desc);
create index if not exists idx_action_items_user_meeting on public.action_items (user_id, meeting_id);

-- --- Documents ---
create index if not exists idx_documents_user_project   on public.documents (user_id, project_id);

-- --- Memory Engine / retention sweep ---
create index if not exists idx_memories_user_category   on public.memories (user_id, category, importance desc);
create index if not exists idx_memories_user_expiry
  on public.memories (user_id, expires_at)
  where expires_at is not null;

-- --- Notification delivery queue ---
create index if not exists idx_notifications_user_delivery
  on public.notifications (user_id, delivery_status, priority desc);

-- --- §60 cost reporting ---
create index if not exists idx_ai_interactions_user_time
  on public.ai_interactions (user_id, timestamp desc);

-- --- §53 audit review ---
create index if not exists idx_audit_logs_user_time     on public.audit_logs (user_id, timestamp desc);
