-- ============================================================================
-- 0012 - Fix RLS infinite recursion ("stack depth limit exceeded")
-- ----------------------------------------------------------------------------
-- Symptom: candidate slot booking fails with `stack depth limit exceeded`.
--
-- Cause: the candidate booking INSERT is checked by policy "interviews insert
-- own", whose subquery selects from public.candidates. Candidates RLS policy
-- "candidates read" calls public.is_manager(), which queries public.users.
-- The users RLS policy "users read own or admin" calls public.is_admin(),
-- which queries public.users again -> policy -> function -> table cycle that
-- never terminates.
--
-- Fix: the role-helper functions become SECURITY DEFINER (with an empty
-- search_path so nothing unqualified can be injected) — their internal reads
-- bypass RLS, breaking the recursion. Idempotent: safe to re-run.
-- ============================================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.name = 'Admin'
  );
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and r.name in ('Admin','Manager','HR')
  );
$$;

create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select employee_id from public.users where id = auth.uid();
$$;

create or replace function public.has_permission(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    join public.role_permissions rp on rp.role_id = u.role_id
    join public.permissions perm on perm.id = rp.permission_id
    where u.id = auth.uid() and perm.name = p_name
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated;
revoke execute on function public.current_employee_id() from public;
grant execute on function public.current_employee_id() to authenticated;
revoke execute on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;
