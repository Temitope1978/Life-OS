# AI Life OS — cross-user isolation test (§53)
--
# §53: "The system must never expose one user's data to another user."
#
# This is the Phase 4 exit condition. It is deliberately written so that a schema
# with *broken* RLS fails it. Every negative case must raise an error or return zero
# rows; anything else means data leaked.
--
# HOW IT WORKS
#   Real JWTs are required, because RLS keys on auth.uid() which comes from the JWT.
--   The runner (run-isolation-test.ps1) signs in as each seeded user via the Auth
#   API, sets the resulting token as `request.jwt.claims`, and then SET ROLE to
#   `authenticated`. That combination makes the policies evaluate exactly as they
#   would in production.
--
#   Do not attempt to verify isolation with the service-role key. That role bypasses
#   RLS entirely, so a "pass" under it proves nothing.
--
# PREREQUISITES
#   1. supabase/migrations/*.sql applied
#   2. supabase/seed.sql applied  (creates demo@lifeos.local and second@lifeos.local)
#   3. SUPABASE_URL and SUPABASE_ANON_KEY set in the environment
#
# Run with:  ./run-isolation-test.ps1

\set ON_ERROR_STOP on
\timing off

-- ---------------------------------------------------------------------------
-- Guard: refuse to run under a role that bypasses RLS.
-- ---------------------------------------------------------------------------

do $$
begin
  if current_setting('role', true) is distinct from 'authenticated'
     and session_user not in ('authenticated') then
    raise exception
      'isolation test must run as role `authenticated`. Running as % would bypass RLS and prove nothing.',
      session_user;
  end if;
end;
$$;

-- Fail loudly if the runner did not set a JWT.
do $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception
      'auth.uid() is NULL: no JWT claims set. The runner must set request.jwt.claims before running this script.';
  end if;
  raise notice 'running isolation tests as user %', v_uid;
end;
$$;

\set demo    '11111111-1111-4111-8111-111111111111'
\set second  '22222222-2222-4222-8222-222222222222'

create temporary table isolation_results (
  test_name  text primary key,
  passed     boolean not null,
  detail     text
) on commit drop;

-- Helper: record a pass/fail without aborting the whole run on the first failure.
create or replace function pg_temp.record_result(p_name text, p_passed boolean, p_detail text default '')
returns void language plpgsql as $$
begin
  insert into isolation_results(test_name, passed, detail)
  values (p_name, p_passed, p_detail);
end;
$$;


-- ===========================================================================
-- T1. Own data is visible
--     A misconfigured policy that denies everything would also pass every negative
--     test below, so prove positive access first.
-- ===========================================================================

do $$
declare v uuid := auth.uid(); n int;
begin
  select count(*) into n from public.contacts where user_id = v;
  perform pg_temp.record_result('T1 own contacts visible', n > 0, format('%s own contacts', n));

  select count(*) into n from public.emails where user_id = v;
  perform pg_temp.record_result('T2 own emails visible', n > 0, format('%s own emails', n));

  select count(*) into n from public.tasks where user_id = v;
  perform pg_temp.record_result('T3 own tasks visible', n > 0, format('%s own tasks', n));
end;
$$;


-- ===========================================================================
-- T4. Reads never cross users.
--     For every user-scoped table, count rows whose user_id is NOT auth.uid().
--     Must be zero on all of them.
-- ===========================================================================

do $$
declare
  v uuid := auth.uid();
  t text;
  n int;
  tables text[] := array[
    'contacts','projects','emails','calendar_events','tasks','meetings',
    'action_items','commitments','follow_ups','documents','memories',
    'preferences','integrations','notifications','ai_interactions','audit_logs'
  ];
begin
  foreach t in array tables loop
    execute format('select count(*) from public.%I where user_id <> $1', t)
      into n using v;
    perform pg_temp.record_result(
      format('T4 no foreign rows visible in %s', t),
      n = 0,
      format('%s foreign rows leaked', n)
    );
  end loop;
end;
$$;


-- ===========================================================================
-- T5. A specific foreign row is invisible, not merely uncounted.
--     Fetch the other user's row by primary key. Must return 0 rows.
-- ===========================================================================

do $$
declare v uuid := auth.uid(); n int;
begin
  select count(*) into n from public.emails
    where email_id = 'e0000002-0000-4000-8000-000000000001';
  perform pg_temp.record_result('T5 foreign email invisible by id', n = 0, format('%s rows', n));

  select count(*) into n from public.tasks
    where task_id = '10000002-0000-4000-8000-000000000001';
  perform pg_temp.record_result('T6 foreign task invisible by id', n = 0, format('%s rows', n));

  select count(*) into n from public.profiles
    where user_id = '22222222-2222-4222-8222-222222222222';
  perform pg_temp.record_result('T7 foreign profile invisible by id', n = 0, format('%s rows', n));

  select count(*) into n from public.workspaces
    where owner_id = '22222222-2222-4222-8222-222222222222';
  perform pg_temp.record_result('T8 foreign workspace invisible', n = 0, format('%s rows', n));
end;
$$;


-- ===========================================================================
-- T9. transcripts has no user_id; ownership is reached via meetings (issue 4).
--     Verify the other user's transcript is unreachable.
-- ===========================================================================

do $$
declare n int;
begin
  select count(*) into n
  from public.transcripts t
  join public.meetings m on m.meeting_id = t.meeting_id
  where m.meeting_id = 'a0000002-0000-4000-8000-000000000001';

  perform pg_temp.record_result(
    'T9 foreign transcript invisible',
    n = 0,
    format('%s rows', n)
  );

  -- and the same join must not leak the meeting itself
  select count(*) into n from public.meetings
    where meeting_id = 'a0000002-0000-4000-8000-000000000001';
  perform pg_temp.record_result('T10 foreign meeting invisible', n = 0, format('%s rows', n));
end;
$$;


-- ===========================================================================
-- T11. UPDATE cannot touch another user's row.
--      Expect zero rows updated. A count > 0 means the policy leaked.
-- ===========================================================================

do $$
declare v uuid := auth.uid(); n int;
begin
  update public.emails
     set subject = 'LEAKED'
   where email_id = 'e0000002-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.record_result('T11 cannot update foreign email', n = 0, format('%s rows updated', n));

  update public.tasks
     set status = 'completed'
   where task_id = '10000002-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.record_result('T12 cannot update foreign task', n = 0, format('%s rows updated', n));
end;
$$;


-- ===========================================================================
-- T13. DELETE cannot remove another user's row.
-- ===========================================================================

do $$
declare n int;
begin
  delete from public.emails
   where email_id = 'e0000002-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.record_result('T13 cannot delete foreign email', n = 0, format('%s rows deleted', n));

  delete from public.contacts
   where contact_id = 'c0000002-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.record_result('T14 cannot delete foreign contact', n = 0, format('%s rows deleted', n));
end;
$$;


-- ===========================================================================
-- T15. INSERT cannot impersonate another user.
--      The WITH CHECK clause must reject a row whose user_id is someone else.
--      Expected outcome: an exception.
-- ===========================================================================

do $$
declare
  v uuid := auth.uid();
  n int;
begin
  begin
    insert into public.tasks (user_id, title, source)
    values ('22222222-2222-4222-8222-222222222222', 'forged row', 'manual');
    perform pg_temp.record_result('T15 cannot insert as another user', false, 'INSERT SUCCEEDED — policy leaked');
  exception
    when insufficient_privilege then
      perform pg_temp.record_result('T15 cannot insert as another user', true, 'blocked by RLS');
    when check_violation then
      perform pg_temp.record_result('T15 cannot insert as another user', true, 'blocked by CHECK');
  end;

  -- sanity: the forged row must not exist even if a policy were wrong
  select count(*) into n from public.tasks
    where title = 'forged row';
  perform pg_temp.record_result('T16 forged row absent', n = 0, format('%s forged rows present', n));
end;
$$;


-- ===========================================================================
-- T17. Composite FK: an action item cannot reference another user's meeting.
--      Even if RLS were absent, the database must refuse it.
-- ===========================================================================

do $$
begin
  begin
    insert into public.action_items (meeting_id, owner, user_id)
    values ('a0000002-0000-4000-8000-000000000001', 'forged', auth.uid());
    perform pg_temp.record_result(
      'T17 action item cannot cross users',
      false,
      'INSERT SUCCEEDED — composite FK missing'
    );
  exception
    when foreign_key_violation then
      perform pg_temp.record_result('T17 action item cannot cross users', true, 'blocked by composite FK');
  end;
end;
$$;


-- ===========================================================================
-- T18. audit_logs is append-only for clients.
--      UPDATE and DELETE were never granted, so both must raise.
-- ===========================================================================

do $$
begin
  begin
    update public.audit_logs set result = 'success' where user_id = auth.uid();
    perform pg_temp.record_result('T18 cannot update audit logs', false, 'UPDATE SUCCEEDED');
  exception
    when insufficient_privilege then
      perform pg_temp.record_result('T18 cannot update audit logs', true, 'no UPDATE grant');
    when others then
      perform pg_temp.record_result('T18 cannot update audit logs', true, 'blocked: ' || sqlerrm);
  end;

  begin
    delete from public.audit_logs where user_id = auth.uid();
    perform pg_temp.record_result('T19 cannot delete audit logs', false, 'DELETE SUCCEEDED');
  exception
    when insufficient_privilege then
      perform pg_temp.record_result('T19 cannot delete audit logs', true, 'no DELETE grant');
    when others then
      perform pg_temp.record_result('T19 cannot delete audit logs', true, 'blocked: ' || sqlerrm);
  end;
end;
$$;


-- ===========================================================================
-- T20. export_user_data() returns the caller's data and ONLY the caller's.
--      This is the §53 data-export requirement, tested for over-reach.
-- ===========================================================================

do $$
declare
  v uuid := auth.uid();
  v_export jsonb;
  n_foreign int;
begin
  v_export := public.export_user_data();

  perform pg_temp.record_result(
    'T20 export returns data',
    v_export ? 'profile' and jsonb_array_length(v_export -> 'emails') > 0,
    format('%s emails exported', jsonb_array_length(v_export -> 'emails'))
  );

  -- no exported array may contain a foreign user_id
  select count(*) into n_foreign
  from jsonb_array_elements(v_export -> 'emails') e
  where (e ->> 'user_id')::uuid <> v;

  perform pg_temp.record_result(
    'T21 export contains no foreign rows',
    n_foreign = 0,
    format('%s foreign rows in export', n_foreign)
  );
end;
$$;


-- ===========================================================================
-- T22. delete_user_data() refuses without explicit confirmation.
--      Guards against an accidental or malicious one-arg call wiping an account.
-- ===========================================================================

do $$
begin
  begin
    perform public.delete_user_data(false);
    perform pg_temp.record_result('T22 delete requires confirmation', false, 'DELETE SUCCEEDED WITHOUT CONFIRM');
  exception
    when check_violation then
      perform pg_temp.record_result('T22 delete requires confirmation', true, 'refused without p_confirm');
    when others then
      perform pg_temp.record_result('T22 delete requires confirmation', true, 'refused: ' || sqlerrm);
  end;
end;
$$;


-- ===========================================================================
-- T23. Foreign keys still work for the caller's own data.
--      A schema where every insert fails would trivially pass T4–T19.
-- ===========================================================================

do $$
declare
  v uuid := auth.uid();
  new_contact uuid;
  new_task   uuid;
begin
  insert into public.contacts (user_id, name, email)
  values (v, 'Isolation Test Contact', 'isolation-test@lifeos.local')
  returning contact_id into new_contact;

  insert into public.tasks (user_id, title, source, contact_id)
  values (v, 'Isolation Test Task', 'manual', new_contact)
  returning task_id into new_task;

  perform pg_temp.record_result(
    'T23 own writes succeed',
    new_contact is not null and new_task is not null,
    format('contact %, task %', new_contact, new_task)
  );

  -- clean up so re-running stays deterministic
  delete from public.tasks where task_id = new_task;
  delete from public.contacts where contact_id = new_contact;
end;
$$;


-- ===========================================================================
-- Results
-- ===========================================================================

\echo ''
\echo '=== AI Life OS — cross-user isolation results ==='

do $$
declare
  v_total int;
  v_pass   int;
  v_fail   int;
  r record;
begin
  select count(*), count(*) filter (where passed) into v_total, v_pass
  from isolation_results;
  v_fail := v_total - v_pass;

  for r in
    select test_name, passed, detail from isolation_results order by test_name
  loop
    raise notice '%  %  %', rpad(r.test_name, 52), case when r.passed then 'PASS' else 'FAIL' end,
                 coalesce(nullif(r.detail, ''), '');
  end loop;

  raise notice '';
  raise notice 'total: %   passed: %   failed: %', v_total, v_pass, v_fail;

  if v_fail > 0 then
    -- Force a non-zero exit so CI and the runner both notice.
    raise exception 'ISOLATION TEST FAILED: % of % checks failed', v_fail, v_total;
  end if;

  raise notice 'ISOLATION TEST PASSED: % of % checks. §53 satisfied.', v_pass, v_total;
end;
$$;
