# AI Life OS — Row Level Security
#
# §53: "The system must never expose one user's data to another user."
#
# Derived decisions 31–39 in DATABASE-DESIGN-DECISIONS.md §8.
#
# Shape of every policy:
#   * `user_id = (select auth.uid())` — the scalar subquery lets the planner evaluate
#     auth.uid() once as an InitPlan instead of per row. On a per-row RLS predicate
#     that is a measurable difference (decision 32).
#   * FORCE ROW LEVEL SECURITY — without it the table owner bypasses policies
#     entirely (decision 31).
#   * `anon` is revoked outright; only `authenticated` gets row access (decision 36).

-- ---------------------------------------------------------------------------
-- Grants: least privilege (§53)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;

-- profiles: SELECT and UPDATE only. INSERT happens via the signup trigger
-- (SECURITY DEFINER), and account deletion goes through delete_user_data() —
-- never a client-side DELETE, so §59 deletion is auditable and complete.
grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on
  public.workspaces,
  public.contacts,
  public.projects,
  public.emails,
  public.calendar_events,
  public.tasks,
  public.meetings,
  public.transcripts,
  public.action_items,
  public.commitments,
  public.follow_ups,
  public.documents,
  public.memories,
  public.preferences,
  public.integrations,
  public.notifications,
  public.ai_interactions
to authenticated;

-- audit_logs is append-only for clients (§53 audit logs). UPDATE and DELETE are
-- never granted, so a compromised client token cannot rewrite history.
grant select, insert on public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Isolation helper
-- ---------------------------------------------------------------------------

-- auth.uid() is null when no user is authenticated; comparing to a NOT NULL column
-- yields NULL, which is not TRUE, so RLS denies the row. That is the safe default
-- and needs no extra guard.
create or replace function public.current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select auth.uid();
$$;

grant execute on function public.current_user_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Uniform policies on user_id
-- ---------------------------------------------------------------------------

-- Applied to: contacts, projects, emails, calendar_events, tasks, meetings,
--              action_items (approved issue 7), commitments, follow_ups, documents,
--              memories, preferences, integrations, notifications, ai_interactions
do $$
declare
  t text;
  tables text[] := array[
    'contacts', 'projects', 'emails', 'calendar_events', 'tasks', 'meetings',
    'action_items', 'commitments', 'follow_ups', 'documents', 'memories',
    'preferences', 'integrations', 'notifications', 'ai_interactions'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format($f$
      create policy %1$I on public.%1$I for select
        using (user_id = (select auth.uid()));
    $f$, t);

    execute format($f$
      create policy %1$I on public.%1$I for insert
        with check (user_id = (select auth.uid()));
    $f$, t);

    execute format($f$
      create policy %1$I on public.%1$I for update
        using      (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()));
    $f$, t);

    execute format($f$
      create policy %1$I on public.%1$I for delete
        using (user_id = (select auth.uid()));
    $f$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — a user may read and update only their own row.
-- INSERT is handled by the signup trigger below, not by a client policy.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select on public.profiles for select
  using (user_id = (select auth.uid()));

create policy profiles_update on public.profiles for update
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- workspaces — issue 2 DEFERRED: membership does not exist yet, so the only
-- access rule is ownership. shared/team type values are reserved for later.
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;

create policy workspaces_select on public.workspaces for select
  using (owner_id = (select auth.uid()));

create policy workspaces_insert on public.workspaces for insert
  with check (owner_id = (select auth.uid()));

create policy workspaces_update on public.workspaces for update
  using      (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy workspaces_delete on public.workspaces for delete
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- transcripts — no user_id column (issue 4); ownership is reached through the
-- meeting. USING and WITH CHECK are identical, so Postgres collapses this to a
-- single-relation subquery instead of self-joining transcripts.
-- ---------------------------------------------------------------------------

alter table public.transcripts enable row level security;
alter table public.transcripts force row level security;

create policy transcripts_select on public.transcripts for select
  using (
    exists (
      select 1 from public.meetings m
      where m.meeting_id = transcripts.meeting_id
        and m.user_id = (select auth.uid())
    )
  );

create policy transcripts_insert on public.transcripts for insert
  with check (
    exists (
      select 1 from public.meetings m
      where m.meeting_id = transcripts.meeting_id
        and m.user_id = (select auth.uid())
    )
  );

create policy transcripts_update on public.transcripts for update
  using (
    exists (
      select 1 from public.meetings m
      where m.meeting_id = transcripts.meeting_id
        and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meetings m
      where m.meeting_id = transcripts.meeting_id
        and m.user_id = (select auth.uid())
    )
  );

create policy transcripts_delete on public.transcripts for delete
  using (
    exists (
      select 1 from public.meetings m
      where m.meeting_id = transcripts.meeting_id
        and m.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- audit_logs — read own, append own. No update, no delete, for clients (§53).
-- ---------------------------------------------------------------------------

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

create policy audit_logs_select on public.audit_logs for select
  using (user_id = (select auth.uid()));

create policy audit_logs_insert on public.audit_logs for insert
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Signup trigger: create a profile row when an auth user is created.
-- Runs as SECURITY DEFINER because the client cannot insert into profiles.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, name, email, timezone, subscription, preferences)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce(new.email, new.id::text || '@placeholder.invalid'),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'Europe/London'),
    'free',
    coalesce(new.raw_user_meta_data -> 'preferences', '{}'::jsonb)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to authenticated;
