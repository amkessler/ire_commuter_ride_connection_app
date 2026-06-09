create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  neighborhood text not null,
  corridor text not null check (
    corridor in (
      'dc-nw',
      'dc-ne',
      'arlington-alexandria',
      'fairfax-falls-church',
      'silver-spring-takoma',
      'bethesda-rockville',
      'pg-county'
    )
  ),
  intent text not null check (intent in ('offer', 'need-seat', 'split-rideshare', 'both')),
  transport_preference text not null check (transport_preference in ('carpool', 'rideshare', 'either')),
  seats_available integer not null default 0 check (seats_available >= 0 and seats_available <= 6),
  max_party_size integer not null default 3 check (max_party_size >= 1 and max_party_size <= 6),
  availability jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.ride_groups (
  id uuid primary key default gen_random_uuid(),
  host_participant_id uuid not null references public.participants(id) on delete cascade,
  type text not null check (type in ('carpool', 'rideshare')),
  corridor text not null check (
    corridor in (
      'dc-nw',
      'dc-ne',
      'arlington-alexandria',
      'fairfax-falls-church',
      'silver-spring-takoma',
      'bethesda-rockville',
      'pg-county'
    )
  ),
  route_flexibility text not null default 'moderate' check (route_flexibility in ('tight', 'moderate', 'flexible')),
  capacity integer not null check (capacity >= 1 and capacity <= 6),
  status text not null default 'open' check (status in ('open', 'pending', 'committed', 'full')),
  availability jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ride_memberships (
  group_id uuid not null references public.ride_groups(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, participant_id)
);

create table if not exists public.ride_inquiries (
  group_id uuid not null references public.ride_groups(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, participant_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_participants_updated_at on public.participants;
create trigger touch_participants_updated_at
before update on public.participants
for each row execute function public.touch_updated_at();

drop trigger if exists touch_ride_groups_updated_at on public.ride_groups;
create trigger touch_ride_groups_updated_at
before update on public.ride_groups
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
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

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_admin() then 'admin' else 'user' end;
$$;

create or replace view public.participant_directory as
select
  id,
  name,
  neighborhood,
  corridor,
  intent,
  transport_preference,
  seats_available,
  max_party_size,
  availability,
  notes,
  created_at,
  updated_at
from public.participants;

create or replace function public.user_owns_participant(participant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants
    where id = participant_uuid
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.user_owns_group(group_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ride_groups rg
    join public.participants p on p.id = rg.host_participant_id
    where rg.id = group_uuid
      and p.user_id = (select auth.uid())
  );
$$;

create or replace function public.group_open_spots(group_uuid uuid)
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

create or replace function public.request_join_ride(p_group_id uuid, p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.user_owns_participant(p_participant_id)) then
    raise exception 'not allowed';
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
  if not (public.is_admin() or public.user_owns_participant(p_participant_id)) then
    raise exception 'not allowed';
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

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.participants enable row level security;
alter table public.ride_groups enable row level security;
alter table public.ride_memberships enable row level security;
alter table public.ride_inquiries enable row level security;

drop policy if exists "Profiles are visible to owner or admins" on public.profiles;
create policy "Profiles are visible to owner or admins"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or public.is_admin());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or public.is_admin())
with check ((select auth.uid()) = id or public.is_admin());

drop policy if exists "Only admins can view admin list" on public.admin_users;
create policy "Only admins can view admin list"
on public.admin_users for select
to authenticated
using (public.is_admin());

drop policy if exists "Participants are visible to owner or admins" on public.participants;
create policy "Participants are visible to owner or admins"
on public.participants for select
to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Users can create their own participant" on public.participants;
create policy "Users can create their own participant"
on public.participants for insert
to authenticated
with check (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Users can update their own participant" on public.participants;
create policy "Users can update their own participant"
on public.participants for update
to authenticated
using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Users can delete their own participant" on public.participants;
create policy "Users can delete their own participant"
on public.participants for delete
to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Authenticated users can view ride groups" on public.ride_groups;
create policy "Authenticated users can view ride groups"
on public.ride_groups for select
to authenticated
using (true);

drop policy if exists "Hosts can create ride groups" on public.ride_groups;
create policy "Hosts can create ride groups"
on public.ride_groups for insert
to authenticated
with check (public.user_owns_participant(host_participant_id) or public.is_admin());

drop policy if exists "Hosts can update ride groups" on public.ride_groups;
create policy "Hosts can update ride groups"
on public.ride_groups for update
to authenticated
using (public.user_owns_group(id) or public.is_admin())
with check (public.user_owns_group(id) or public.is_admin());

drop policy if exists "Hosts can delete ride groups" on public.ride_groups;
create policy "Hosts can delete ride groups"
on public.ride_groups for delete
to authenticated
using (public.user_owns_group(id) or public.is_admin());

drop policy if exists "Authenticated users can view memberships" on public.ride_memberships;
create policy "Authenticated users can view memberships"
on public.ride_memberships for select
to authenticated
using (true);

drop policy if exists "Users can delete their own memberships" on public.ride_memberships;
create policy "Users can delete their own memberships"
on public.ride_memberships for delete
to authenticated
using (public.user_owns_participant(participant_id) or public.user_owns_group(group_id) or public.is_admin());

drop policy if exists "Authenticated users can view inquiries" on public.ride_inquiries;
create policy "Authenticated users can view inquiries"
on public.ride_inquiries for select
to authenticated
using (true);

drop policy if exists "Users can delete their own inquiries" on public.ride_inquiries;
create policy "Users can delete their own inquiries"
on public.ride_inquiries for delete
to authenticated
using (public.user_owns_participant(participant_id) or public.user_owns_group(group_id) or public.is_admin());

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.participants to authenticated;
grant select, insert, update, delete on public.ride_groups to authenticated;
grant select, insert, delete on public.ride_memberships to authenticated;
grant select, insert, delete on public.ride_inquiries to authenticated;
grant select on public.participant_directory to authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.request_join_ride(uuid, uuid) to authenticated;
grant execute on function public.commit_to_ride(uuid, uuid) to authenticated;
