# AI Life OS — data export and account deletion (§53, §59)
#
# Derived decision 38 in DATABASE-DESIGN-DECISIONS.md §8.
#
# Both functions are SECURITY DEFINER owned by postgres, so they are not subject to
-- the caller's RLS. That is the point: §59 requires a user to export or delete
# their *entire* account, which a per-table RLS policy cannot express because the
# caller may hold no row-level grant at all (profiles has no DELETE grant).
#
# SECURITY INVOKER would therefore be wrong here. The trade-off is that
# these functions bypass RLS by design, so both re-derive the target user from
-- auth.uid() and never accept a user id parameter. A caller can only ever act on
# themselves.

-- ---------------------------------------------------------------------------
-- export_user_data — §53 "data export", §59 "how to delete information"
-- ---------------------------------------------------------------------------

create or replace function public.export_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'export_user_data requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'schema_version', 1,
    'profile',        (select to_jsonb(p) from public.profiles p where p.user_id = v_uid),
    'workspaces',     (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from public.workspaces w where w.owner_id = v_uid),
    'contacts',       (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.contacts c where c.user_id = v_uid),
    'projects',       (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.projects p where p.user_id = v_uid),
    'emails',         (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from public.emails e where e.user_id = v_uid),
    'calendar_events',(select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from public.calendar_events e where e.user_id = v_uid),
    'tasks',          (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tasks t where t.user_id = v_uid),
    'meetings',       (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.meetings m where m.user_id = v_uid),
    'transcripts',    (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                        from public.transcripts t
                        join public.meetings m on m.meeting_id = t.meeting_id
                        where m.user_id = v_uid),
    'action_items',   (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.action_items a where a.user_id = v_uid),
    'commitments',    (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.commitments c where c.user_id = v_uid),
    'follow_ups',     (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from public.follow_ups f where f.user_id = v_uid),
    'documents',      (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.documents d where d.user_id = v_uid),
    'memories',       (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.memories m where m.user_id = v_uid),
    'preferences',    (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.preferences p where p.user_id = v_uid),
    'integrations',   (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.integrations i where i.user_id = v_uid),
    'notifications',  (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) from public.notifications n where n.user_id = v_uid),
    'ai_interactions',(select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.ai_interactions a where a.user_id = v_uid),
    'audit_logs',     (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.audit_logs a where a.user_id = v_uid)
  ) into v_out;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_user_data — §53 "data deletion", §59 "how to delete information"
--
-- Deletes the auth.users row. Every table cascades from profiles.user_id, so this
-- single statement removes all personal data (§59, decision 19). An audit record is
-- written first so the deletion itself is traceable.
-- ---------------------------------------------------------------------------

create or replace function public.delete_user_data(p_confirm boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_counts jsonb;
begin
  if v_uid is null then
    raise exception 'delete_user_data requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  if p_confirm is not true then
    raise exception 'delete_user_data requires p_confirm => true'
      using errcode = 'check_violation';
  end if;

  -- Record the intent before the cascade removes the audit table contents too.
  begin
    insert into public.audit_logs (user_id, action, actor, result)
    values (v_uid, 'account.delete', 'user', 'success');
  exception when foreign_key_violation then
    -- profiles already gone; nothing left to delete.
    null;
  end;

  select jsonb_build_object(
    'contacts',        (select count(*) from public.contacts where user_id = v_uid),
    'projects',        (select count(*) from public.projects where user_id = v_uid),
    'emails',          (select count(*) from public.emails where user_id = v_uid),
    'calendar_events', (select count(*) from public.calendar_events where user_id = v_uid),
    'tasks',           (select count(*) from public.tasks where user_id = v_uid),
    'meetings',        (select count(*) from public.meetings where user_id = v_uid),
    'action_items',    (select count(*) from public.action_items where user_id = v_uid),
    'commitments',     (select count(*) from public.commitments where user_id = v_uid),
    'follow_ups',      (select count(*) from public.follow_ups where user_id = v_uid),
    'documents',       (select count(*) from public.documents where user_id = v_uid),
    'memories',        (select count(*) from public.memories where user_id = v_uid)
  ) into v_counts;

  delete from auth.users where id = v_uid;

  return jsonb_build_object(
    'deleted', true,
    'deleted_at', now(),
    'row_counts', v_counts
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated only, never anon, never public.
-- ---------------------------------------------------------------------------

revoke all on function public.export_user_data() from public;
revoke all on function public.delete_user_data(boolean) from public;

grant execute on function public.export_user_data() to authenticated;
grant execute on function public.delete_user_data(boolean) to authenticated;

-- Neither function takes a user id argument, so a caller can only ever export or
-- delete their own account. That is what makes SECURITY DEFINER safe here.
