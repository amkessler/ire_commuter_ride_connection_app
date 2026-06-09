create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.has_admin_access()
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
  )
  and coalesce((auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

create or replace function private.group_open_spots(group_uuid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    rg.capacity -
      (
        count(rm.participant_id)::integer +
        case when rg.type = 'rideshare' then 1 else 0 end
      ),
    0
  )
  from public.ride_groups rg
  left join public.ride_memberships rm on rm.group_id = rg.id
  where rg.id = group_uuid
  group by rg.id, rg.capacity, rg.type;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select case when private.has_admin_access() then 'admin' else 'user' end;
$$;

drop policy if exists "Profiles are visible to owner or admins" on public.profiles;
create policy "Profiles are visible to owner or admins"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or private.has_admin_access());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or private.has_admin_access())
with check ((select auth.uid()) = id or private.has_admin_access());

drop policy if exists "Only admins can view admin list" on public.admin_users;
create policy "Only admins can view admin list"
on public.admin_users for select
to authenticated
using (private.has_admin_access());

drop policy if exists "Participants are visible to owner or admins" on public.participants;
create policy "Participants are visible to owner or admins"
on public.participants for select
to authenticated
using (user_id = (select auth.uid()) or private.has_admin_access());

drop policy if exists "Users can create their own participant" on public.participants;
create policy "Users can create their own participant"
on public.participants for insert
to authenticated
with check (user_id = (select auth.uid()) or private.has_admin_access());

drop policy if exists "Users can update their own participant" on public.participants;
create policy "Users can update their own participant"
on public.participants for update
to authenticated
using (user_id = (select auth.uid()) or private.has_admin_access())
with check (user_id = (select auth.uid()) or private.has_admin_access());

drop policy if exists "Users can delete their own participant" on public.participants;
create policy "Users can delete their own participant"
on public.participants for delete
to authenticated
using (user_id = (select auth.uid()) or private.has_admin_access());

drop policy if exists "Hosts can create ride groups" on public.ride_groups;
create policy "Hosts can create ride groups"
on public.ride_groups for insert
to authenticated
with check (
  exists (
    select 1
    from public.participants p
    where p.id = host_participant_id
      and p.user_id = (select auth.uid())
  )
  or private.has_admin_access()
);

drop policy if exists "Hosts can update ride groups" on public.ride_groups;
create policy "Hosts can update ride groups"
on public.ride_groups for update
to authenticated
using (
  exists (
    select 1
    from public.participants p
    where p.id = ride_groups.host_participant_id
      and p.user_id = (select auth.uid())
  )
  or private.has_admin_access()
)
with check (
  exists (
    select 1
    from public.participants p
    where p.id = ride_groups.host_participant_id
      and p.user_id = (select auth.uid())
  )
  or private.has_admin_access()
);

drop policy if exists "Hosts can delete ride groups" on public.ride_groups;
create policy "Hosts can delete ride groups"
on public.ride_groups for delete
to authenticated
using (
  exists (
    select 1
    from public.participants p
    where p.id = ride_groups.host_participant_id
      and p.user_id = (select auth.uid())
  )
  or private.has_admin_access()
);

drop policy if exists "Users can delete their own memberships" on public.ride_memberships;
create policy "Users can delete their own memberships"
on public.ride_memberships for delete
to authenticated
using (
  exists (
    select 1
    from public.participants p
    where p.id = ride_memberships.participant_id
      and p.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.ride_groups rg
    join public.participants p on p.id = rg.host_participant_id
    where rg.id = ride_memberships.group_id
      and p.user_id = (select auth.uid())
  )
  or private.has_admin_access()
);

drop policy if exists "Users can delete their own inquiries" on public.ride_inquiries;
create policy "Users can delete their own inquiries"
on public.ride_inquiries for delete
to authenticated
using (
  exists (
    select 1
    from public.participants p
    where p.id = ride_inquiries.participant_id
      and p.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.ride_groups rg
    join public.participants p on p.id = rg.host_participant_id
    where rg.id = ride_inquiries.group_id
      and p.user_id = (select auth.uid())
  )
  or private.has_admin_access()
);

create or replace function public.request_join_ride(p_group_id uuid, p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not (
    private.has_admin_access()
    or exists (
      select 1
      from public.participants
      where id = p_participant_id
        and user_id = (select auth.uid())
    )
  ) then
    raise exception 'not allowed';
  end if;

  if exists (
    select 1 from public.ride_groups
    where id = p_group_id
      and host_participant_id = p_participant_id
  ) then
    raise exception 'host is already in ride group';
  end if;

  if private.group_open_spots(p_group_id) <= 0 then
    raise exception 'ride group is full';
  end if;

  insert into public.ride_inquiries (group_id, participant_id)
  values (p_group_id, p_participant_id)
  on conflict do nothing;

  update public.ride_groups
  set status = case when status = 'open' then 'pending' else status end
  where id = p_group_id;
end;
$$;

create or replace function public.commit_to_ride(p_group_id uuid, p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  next_open_spots integer;
begin
  if not (
    private.has_admin_access()
    or exists (
      select 1
      from public.participants
      where id = p_participant_id
        and user_id = (select auth.uid())
    )
  ) then
    raise exception 'not allowed';
  end if;

  if exists (
    select 1 from public.ride_groups
    where id = p_group_id
      and host_participant_id = p_participant_id
  ) then
    raise exception 'host is already in ride group';
  end if;

  if private.group_open_spots(p_group_id) <= 0 then
    raise exception 'ride group is full';
  end if;

  insert into public.ride_memberships (group_id, participant_id)
  values (p_group_id, p_participant_id)
  on conflict do nothing;

  delete from public.ride_inquiries
  where group_id = p_group_id
    and participant_id = p_participant_id;

  next_open_spots := private.group_open_spots(p_group_id);

  update public.ride_groups
  set status = case when next_open_spots <= 0 then 'full' else 'committed' end
  where id = p_group_id;
end;
$$;

revoke execute on function public.commit_to_ride(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.request_join_ride(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.get_my_role() from public, anon, authenticated;
revoke execute on function public.group_open_spots(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_admin_access() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.user_owns_group(uuid) from public, anon, authenticated;
revoke execute on function public.user_owns_participant(uuid) from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function public.commit_to_ride(uuid, uuid) to authenticated;
grant execute on function public.request_join_ride(uuid, uuid) to authenticated;
grant execute on function public.get_my_role() to authenticated;
