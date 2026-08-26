-- ============================================================================
-- 0010 - Candidate auth RPC + missing reschedule columns
-- 1) Interviews: the candidate portal reads/writes reschedule_requested and
--    reschedule_status (booking + admin review) but those columns were never
--    added to the schema — the reschedule flow would fail with "column does
--    not exist". Added here (idempotent).
-- 2) create_candidate_with_auth: creates the candidates row AND the linked
--    auth.users account in one call, so candidates added via the admin
--    "Add Candidate" form or the public careers apply page can log straight
--    into the candidate portal (temp_id + password 1234). Non-null GoTrue
--    columns are set explicitly to avoid the NULL-token login bug.
-- ============================================================================

alter table public.interviews
  add column if not exists reschedule_requested boolean not null default false,
  add column if not exists reschedule_status text;

create or replace function public.create_candidate_with_auth(
  p_name text,
  p_email text,
  p_phone text default null,
  p_job_opening_id uuid default null,
  p_source text default null,
  p_resume_url text default null,
  p_cover_letter text default null,
  p_category text default 'Fresher'
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := extensions.gen_random_uuid();
  v_cand_id uuid := extensions.gen_random_uuid();
  v_temp_id text := '00000000-0000-4000-8000-' || substr(extensions.gen_random_uuid()::text, 20);
  v_candidate_no int;
begin
  if exists (select 1 from auth.users u where lower(u.email) = lower(p_email)) then
    raise exception 'A candidate with this email already has an account';
  end if;

  select coalesce(max(substring(candidate_id from 5)::int), 0) + 1
  into v_candidate_no
  from public.candidates
  where candidate_id like 'CND-%';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token,
    reauthentication_token, is_anonymous, is_sso_user, email_change_confirm_status
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    lower(p_email),
    extensions.crypt('1234', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', p_name, 'role', 'Candidate'),
    '', '', '', '', '', '', '', '', false, false, 0
  );

  insert into public.candidates (
    id, temp_id, user_id, candidate_id, job_opening_id, name, email, phone,
    resume_url, cover_letter, status, source, category, applied_at, updated_at
  ) values (
    v_cand_id, v_temp_id, v_user_id,
    'CND-' || lpad(v_candidate_no::text, 4, '0'),
    p_job_opening_id, p_name, lower(p_email), p_phone,
    p_resume_url, p_cover_letter, 'applied', p_source, p_category, now(), now()
  );

  return v_temp_id;
end;
$$;

revoke execute on function public.create_candidate_with_auth(text, text, text, uuid, text, text, text, text) from public;
grant execute on function public.create_candidate_with_auth(text, text, text, uuid, text, text, text, text) to anon, authenticated;