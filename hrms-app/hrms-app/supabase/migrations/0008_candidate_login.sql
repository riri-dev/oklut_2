-- ============================================================================
-- Candidate Portal Login
-- The candidate enters their ID (= public.candidates.temp_id) and password.
-- The ID is resolved against public.candidates; the password is verified
-- against the linked auth.users row (encrypted_password). On success the
-- client signs into Supabase Auth so the portal reads/writes (interviews,
-- offers, slot bookings) run under the candidate-own RLS policies below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Candidate login RPC — security definer (bypasses RLS), fully qualified.
--    Returns: authenticated, the candidate row (jsonb, with embedded
--    job_opening), and the auth email used to create the portal session.
-- ---------------------------------------------------------------------------
create or replace function public.candidate_login(p_temp_id text, p_password text)
returns table (authenticated boolean, candidate_data jsonb, auth_email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cand public.candidates%rowtype;
  v_email auth.users.email%type;
begin
  select * into v_cand
  from public.candidates c
  where c.temp_id = p_temp_id
  limit 1;

  if not found then
    return query select false, null::jsonb, null::text;
    return;
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_cand.user_id
    and u.encrypted_password = extensions.crypt(p_password, u.encrypted_password);

  if v_email is null then
    return query select false, null::jsonb, null::text;
    return;
  end if;

  return query
  select
    true,
    (to_jsonb(v_cand) || jsonb_build_object(
      'job_opening', (select to_jsonb(jo) from public.job_openings jo where jo.id = v_cand.job_opening_id)
    ))::jsonb,
    v_email::text;
end;
$$;

revoke execute on function public.candidate_login(text, text) from public;
grant execute on function public.candidate_login(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Sync candidate auth users — email/password sourced from the candidates
--    table so the portal session can be created with signInWithPassword.
--    Demo password: 1234 (matches the HRMS demo accounts).
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token, is_anonymous, is_sso_user, email_change_confirm_status
)
select
  c.user_id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  lower(c.email),
  extensions.crypt('1234', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('name', c.name, 'role', 'Candidate'),
  '', '', '', '',
  '', '', '', '', false, false, 0
from public.candidates c
where c.user_id is not null
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = now(),
  updated_at = now(),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  email_change_token_current = coalesce(auth.users.email_change_token_current, ''),
  phone_change = coalesce(auth.users.phone_change, ''),
  phone_change_token = coalesce(auth.users.phone_change_token, ''),
  reauthentication_token = coalesce(auth.users.reauthentication_token, ''),
  is_anonymous = coalesce(auth.users.is_anonymous, false),
  is_sso_user = coalesce(auth.users.is_sso_user, false),
  email_change_confirm_status = coalesce(auth.users.email_change_confirm_status, 0);

insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
select
  gen_random_uuid(),
  c.user_id::text,
  c.user_id,
  jsonb_build_object('sub', c.user_id::text, 'email', lower(c.email), 'email_verified', true),
  'email',
  now(),
  now()
from public.candidates c
where c.user_id is not null
on conflict (provider_id, provider) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Candidate self-service RLS — the signed-in portal session
--    (auth.uid() = candidates.user_id) may read/update its own rows.
--    Existing manager policies from 0001 remain untouched.
-- ---------------------------------------------------------------------------
drop policy if exists "candidates read own" on public.candidates;
drop policy if exists "candidates update own" on public.candidates;
drop policy if exists "interviews read own" on public.interviews;
drop policy if exists "interviews update own" on public.interviews;
drop policy if exists "offers read own" on public.offers;
drop policy if exists "offers update own" on public.offers;

create policy "candidates read own"
  on public.candidates for select to authenticated
  using (auth.uid() = user_id);

create policy "candidates update own"
  on public.candidates for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "interviews read own"
  on public.interviews for select to authenticated
  using (candidate_id in (select id from public.candidates where user_id = auth.uid()));

create policy "interviews update own"
  on public.interviews for update to authenticated
  using (candidate_id in (select id from public.candidates where user_id = auth.uid()))
  with check (candidate_id in (select id from public.candidates where user_id = auth.uid()));

create policy "offers read own"
  on public.offers for select to authenticated
  using (candidate_id in (select id from public.candidates where user_id = auth.uid()));

create policy "offers update own"
  on public.offers for update to authenticated
  using (candidate_id in (select id from public.candidates where user_id = auth.uid()))
  with check (candidate_id in (select id from public.candidates where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Admin helper (run in Supabase SQL Editor to create/reset a candidate login):
--   insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
--     email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
--     confirmation_token, recovery_token, email_change_token_new, email_change)
--   select gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
--     'authenticated', 'authenticated', lower('candidate@email.com'),
--     extensions.crypt('newpassword', extensions.gen_salt('bf')),
--     now(), now(), now(), '{"provider":"email","providers":["email"]}',
--     '{"role":"Candidate"}', '', '', '', '';
--   update public.candidates
--     set temp_id = '<unique-login-id>', user_id = '<the-new-auth-user-id>'
--     where id = '<candidate-row-id>';
-- ---------------------------------------------------------------------------