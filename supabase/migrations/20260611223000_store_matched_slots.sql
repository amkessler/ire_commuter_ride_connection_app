alter table public.ride_inquiries
add column if not exists interest_slots text[] not null default array[]::text[];

alter table public.ride_memberships
add column if not exists matched_slots text[] not null default array[]::text[];

create or replace function private.availability_active_slots(target_availability jsonb)
returns text[]
language sql
stable
set search_path = public, private
as $$
  select coalesce(array_agg(active_slots.key order by active_slots.key), array[]::text[])
  from jsonb_each(coalesce(target_availability, '{}'::jsonb)) as active_slots(key, value)
  where active_slots.value = 'true'::jsonb;
$$;

create or replace function private.availability_overlap_slots(first_availability jsonb, second_availability jsonb)
returns text[]
language sql
stable
set search_path = public, private
as $$
  select coalesce(array_agg(first_slots.key order by first_slots.key), array[]::text[])
  from jsonb_each(coalesce(first_availability, '{}'::jsonb)) as first_slots(key, value)
  join jsonb_each(coalesce(second_availability, '{}'::jsonb)) as second_slots(key, value)
    on second_slots.key = first_slots.key
  where first_slots.value = 'true'::jsonb
    and second_slots.value = 'true'::jsonb;
$$;

update public.ride_inquiries ri
set interest_slots = private.availability_overlap_slots(rg.availability, p.availability)
from public.ride_groups rg, public.participants p
where rg.id = ri.group_id
  and p.id = ri.participant_id
  and cardinality(ri.interest_slots) = 0;

update public.ride_memberships rm
set matched_slots = private.availability_overlap_slots(rg.availability, p.availability)
from public.ride_groups rg, public.participants p
where rg.id = rm.group_id
  and p.id = rm.participant_id
  and cardinality(rm.matched_slots) = 0;

create or replace function private.normalize_slot_selection(
  requested_slots text[],
  allowed_slots text[]
)
returns text[]
language sql
stable
set search_path = public, private
as $$
  select coalesce(array_agg(distinct selected_slot order by selected_slot), array[]::text[])
  from unnest(coalesce(requested_slots, allowed_slots)) as selected_slot
  where selected_slot = any(allowed_slots);
$$;

create or replace function private.slot_array_without(source_slots text[], slots_to_remove text[])
returns text[]
language sql
stable
set search_path = public, private
as $$
  select coalesce(array_agg(distinct source_slot order by source_slot), array[]::text[])
  from unnest(coalesce(source_slots, array[]::text[])) as source_slot
  where not source_slot = any(coalesce(slots_to_remove, array[]::text[]));
$$;

create or replace function private.slot_array_union(first_slots text[], second_slots text[])
returns text[]
language sql
stable
set search_path = public, private
as $$
  select coalesce(array_agg(distinct slot_id order by slot_id), array[]::text[])
  from (
    select unnest(coalesce(first_slots, array[]::text[])) as slot_id
    union
    select unnest(coalesce(second_slots, array[]::text[])) as slot_id
  ) combined_slots;
$$;

create or replace function private.group_slot_open_spots(group_uuid uuid, slot_id text)
returns integer
language sql
stable
security definer
set search_path = public, private
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
  left join public.ride_memberships rm
    on rm.group_id = rg.id
    and slot_id = any(rm.matched_slots)
  where rg.id = group_uuid
  group by rg.id, rg.capacity, rg.type;
$$;

create or replace function private.group_open_spots(group_uuid uuid)
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(max(private.group_slot_open_spots(rg.id, slot_id)), 0)
  from public.ride_groups rg
  cross join unnest(private.availability_active_slots(rg.availability)) as slot_id
  where rg.id = group_uuid;
$$;

create or replace function private.group_has_open_spots_for_slots(group_uuid uuid, selected_slots text[])
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(bool_and(private.group_slot_open_spots(group_uuid, slot_id) > 0), false)
  from unnest(coalesce(selected_slots, array[]::text[])) as slot_id;
$$;

create or replace function private.set_ride_group_status_from_activity(group_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  has_memberships boolean;
  has_inquiries boolean;
  next_open_spots integer;
begin
  select exists (
    select 1
    from public.ride_memberships
    where group_id = group_uuid
      and cardinality(matched_slots) > 0
  )
  into has_memberships;

  select exists (
    select 1
    from public.ride_inquiries
    where group_id = group_uuid
      and cardinality(interest_slots) > 0
  )
  into has_inquiries;

  next_open_spots := private.group_open_spots(group_uuid);

  update public.ride_groups
  set status = case
    when next_open_spots <= 0 then 'full'
    when has_memberships then 'committed'
    when has_inquiries then 'pending'
    else 'open'
  end
  where id = group_uuid;
end;
$$;

drop function if exists public.request_join_ride(uuid, uuid);
drop function if exists public.commit_to_ride(uuid, uuid);

create or replace function public.request_join_ride(
  p_group_id uuid,
  p_participant_id uuid,
  p_slot_ids text[] default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_group public.ride_groups%rowtype;
  participant_to_match public.participants%rowtype;
  allowed_slots text[];
  selected_slots text[];
  already_matched_slots text[];
begin
  select *
  into target_group
  from public.ride_groups
  where id = p_group_id;

  if target_group.id is null then
    raise exception 'ride group not found';
  end if;

  select *
  into participant_to_match
  from public.participants
  where id = p_participant_id;

  if participant_to_match.id is null then
    raise exception 'participant not found';
  end if;

  if not (private.has_admin_access() or public.user_owns_participant(p_participant_id)) then
    raise exception 'not allowed';
  end if;

  if target_group.host_participant_id = p_participant_id then
    raise exception 'host is already in ride group';
  end if;

  allowed_slots := private.availability_overlap_slots(target_group.availability, participant_to_match.availability);
  selected_slots := private.normalize_slot_selection(p_slot_ids, allowed_slots);

  select coalesce(matched_slots, array[]::text[])
  into already_matched_slots
  from public.ride_memberships
  where group_id = p_group_id
    and participant_id = p_participant_id;

  selected_slots := private.slot_array_without(selected_slots, already_matched_slots);

  if cardinality(selected_slots) = 0 then
    raise exception 'choose at least one unmatched shared conference slot';
  end if;

  if not private.group_has_open_spots_for_slots(p_group_id, selected_slots) then
    raise exception 'one or more selected slots are full';
  end if;

  insert into public.ride_inquiries (group_id, participant_id, interest_slots)
  values (p_group_id, p_participant_id, selected_slots)
  on conflict (group_id, participant_id) do update
  set interest_slots = excluded.interest_slots;

  perform private.set_ride_group_status_from_activity(p_group_id);
end;
$$;

create or replace function public.commit_to_ride(
  p_group_id uuid,
  p_participant_id uuid,
  p_slot_ids text[] default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_group public.ride_groups%rowtype;
  participant_to_match public.participants%rowtype;
  pending_inquiry public.ride_inquiries%rowtype;
  actor_is_group_host boolean;
  actor_owns_participant boolean;
  wants_carpool_seat boolean;
  wants_rideshare boolean;
  offers_carpool boolean;
  selected_slots text[];
  remaining_interest_slots text[];
begin
  select *
  into target_group
  from public.ride_groups
  where id = p_group_id;

  if target_group.id is null then
    raise exception 'ride group not found';
  end if;

  select *
  into participant_to_match
  from public.participants
  where id = p_participant_id;

  if participant_to_match.id is null then
    raise exception 'participant not found';
  end if;

  if target_group.host_participant_id = p_participant_id then
    raise exception 'host is already in ride group';
  end if;

  select *
  into pending_inquiry
  from public.ride_inquiries
  where group_id = p_group_id
    and participant_id = p_participant_id;

  if pending_inquiry.group_id is null or cardinality(pending_inquiry.interest_slots) = 0 then
    raise exception 'match requires an inquiry first';
  end if;

  select exists (
    select 1
    from public.participants
    where id = p_participant_id
      and user_id = (select auth.uid())
  )
  into actor_owns_participant;

  select exists (
    select 1
    from public.participants
    where id = target_group.host_participant_id
      and user_id = (select auth.uid())
  )
  into actor_is_group_host;

  wants_carpool_seat :=
    participant_to_match.intent = 'need-seat'
    or (participant_to_match.intent = 'both' and participant_to_match.seats_needed > 0)
    or (
      participant_to_match.transport_preference in ('carpool', 'either')
      and participant_to_match.seats_needed > 0
    );

  wants_rideshare :=
    participant_to_match.intent = 'split-rideshare'
    or participant_to_match.intent = 'both'
    or participant_to_match.transport_preference in ('rideshare', 'either');

  offers_carpool :=
    participant_to_match.intent in ('offer', 'both')
    and participant_to_match.transport_preference <> 'rideshare'
    and participant_to_match.seats_available > 0;

  if target_group.type = 'carpool' then
    if not wants_carpool_seat then
      raise exception 'participant does not need a carpool seat';
    end if;

    if not (private.has_admin_access() or actor_is_group_host) then
      raise exception 'only the carpool driver can mark a match';
    end if;
  elsif target_group.type = 'rideshare' then
    if not wants_rideshare then
      raise exception 'participant is not looking for rideshare';
    end if;

    if not (private.has_admin_access() or actor_is_group_host or actor_owns_participant) then
      raise exception 'only people involved in this rideshare can mark a match';
    end if;
  elsif target_group.type = 'carpool-request' then
    if not offers_carpool then
      raise exception 'participant cannot offer carpool help';
    end if;

    if not (private.has_admin_access() or actor_owns_participant) then
      raise exception 'only a carpool driver can mark this request matched';
    end if;
  else
    raise exception 'unsupported ride group type';
  end if;

  selected_slots := private.normalize_slot_selection(p_slot_ids, pending_inquiry.interest_slots);

  if cardinality(selected_slots) = 0 then
    raise exception 'choose at least one pending conference slot';
  end if;

  if not private.group_has_open_spots_for_slots(p_group_id, selected_slots) then
    raise exception 'one or more selected slots are full';
  end if;

  insert into public.ride_memberships (group_id, participant_id, matched_slots)
  values (p_group_id, p_participant_id, selected_slots)
  on conflict (group_id, participant_id) do update
  set matched_slots = private.slot_array_union(ride_memberships.matched_slots, excluded.matched_slots);

  remaining_interest_slots := private.slot_array_without(pending_inquiry.interest_slots, selected_slots);

  if cardinality(remaining_interest_slots) > 0 then
    update public.ride_inquiries
    set interest_slots = remaining_interest_slots
    where group_id = p_group_id
      and participant_id = p_participant_id;
  else
    delete from public.ride_inquiries
    where group_id = p_group_id
      and participant_id = p_participant_id;
  end if;

  perform private.set_ride_group_status_from_activity(p_group_id);
end;
$$;

grant execute on function public.request_join_ride(uuid, uuid, text[]) to authenticated;
grant execute on function public.commit_to_ride(uuid, uuid, text[]) to authenticated;

do $$
declare
  ride_group record;
begin
  for ride_group in
    select id
    from public.ride_groups
  loop
    perform private.set_ride_group_status_from_activity(ride_group.id);
  end loop;
end;
$$;
