create or replace function private.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

create or replace function private.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_admin_user()
    and coalesce((auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select case when private.is_admin_user() then 'admin' else 'user' end;
$$;

revoke execute on function private.is_admin_user() from public, anon;
grant execute on function private.is_admin_user() to authenticated;

revoke execute on function public.get_my_role() from public, anon, authenticated;
grant execute on function public.get_my_role() to authenticated;
