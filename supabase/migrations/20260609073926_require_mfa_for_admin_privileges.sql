create or replace function public.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    and coalesce((auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

drop policy if exists "Profiles are visible to owner or admins" on public.profiles;
create policy "Profiles are visible to owner or admins"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or public.has_admin_access());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or public.has_admin_access())
with check ((select auth.uid()) = id or public.has_admin_access());

drop policy if exists "Only admins can view admin list" on public.admin_users;
create policy "Only admins can view admin list"
on public.admin_users for select
to authenticated
using (public.has_admin_access());

drop policy if exists "Participants are visible to owner or admins" on public.participants;
create policy "Participants are visible to owner or admins"
on public.participants for select
to authenticated
using (user_id = (select auth.uid()) or public.has_admin_access());

drop policy if exists "Users can create their own participant" on public.participants;
create policy "Users can create their own participant"
on public.participants for insert
to authenticated
with check (user_id = (select auth.uid()) or public.has_admin_access());

drop policy if exists "Users can update their own participant" on public.participants;
create policy "Users can update their own participant"
on public.participants for update
to authenticated
using (user_id = (select auth.uid()) or public.has_admin_access())
with check (user_id = (select auth.uid()) or public.has_admin_access());

drop policy if exists "Users can delete their own participant" on public.participants;
create policy "Users can delete their own participant"
on public.participants for delete
to authenticated
using (user_id = (select auth.uid()) or public.has_admin_access());

drop policy if exists "Hosts can create ride groups" on public.ride_groups;
create policy "Hosts can create ride groups"
on public.ride_groups for insert
to authenticated
with check (public.user_owns_participant(host_participant_id) or public.has_admin_access());

drop policy if exists "Hosts can update ride groups" on public.ride_groups;
create policy "Hosts can update ride groups"
on public.ride_groups for update
to authenticated
using (public.user_owns_group(id) or public.has_admin_access())
with check (public.user_owns_group(id) or public.has_admin_access());

drop policy if exists "Hosts can delete ride groups" on public.ride_groups;
create policy "Hosts can delete ride groups"
on public.ride_groups for delete
to authenticated
using (public.user_owns_group(id) or public.has_admin_access());

drop policy if exists "Users can delete their own memberships" on public.ride_memberships;
create policy "Users can delete their own memberships"
on public.ride_memberships for delete
to authenticated
using (
  public.user_owns_participant(participant_id)
  or public.user_owns_group(group_id)
  or public.has_admin_access()
);

drop policy if exists "Users can delete their own inquiries" on public.ride_inquiries;
create policy "Users can delete their own inquiries"
on public.ride_inquiries for delete
to authenticated
using (
  public.user_owns_participant(participant_id)
  or public.user_owns_group(group_id)
  or public.has_admin_access()
);

create or replace function public.request_join_ride(p_group_id uuid, p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_admin_access() or public.user_owns_participant(p_participant_id)) then
    raise exception 'not allowed';
  end if;

  if exists (
    select 1 from public.ride_groups
    where id = p_group_id
      and host_participant_id = p_participant_id
  ) then
    raise exception 'host is already in ride group';
  end if;

  if public.group_open_spots(p_group_id) <= 0 then
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
set search_path = public
as $$
declare
  next_open_spots integer;
begin
  if not (public.has_admin_access() or public.user_owns_participant(p_participant_id)) then
    raise exception 'not allowed';
  end if;

  if exists (
    select 1 from public.ride_groups
    where id = p_group_id
      and host_participant_id = p_participant_id
  ) then
    raise exception 'host is already in ride group';
  end if;

  if public.group_open_spots(p_group_id) <= 0 then
    raise exception 'ride group is full';
  end if;

  insert into public.ride_memberships (group_id, participant_id)
  values (p_group_id, p_participant_id)
  on conflict do nothing;

  delete from public.ride_inquiries
  where group_id = p_group_id
    and participant_id = p_participant_id;

  next_open_spots := public.group_open_spots(p_group_id);

  update public.ride_groups
  set status = case when next_open_spots <= 0 then 'full' else 'committed' end
  where id = p_group_id;
end;
$$;

grant execute on function public.has_admin_access() to authenticated;
