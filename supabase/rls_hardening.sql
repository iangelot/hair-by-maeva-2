-- Availability exclusions are intentionally server-only. The public booking API
-- computes available slots without exposing Maeva's private blocked schedule.
drop policy if exists "public can read blocked dates" on public.blocked_dates;
drop policy if exists "public can read blocked times" on public.blocked_times;

-- Avoid RLS recursion when an admin policy checks membership in admin_users.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
