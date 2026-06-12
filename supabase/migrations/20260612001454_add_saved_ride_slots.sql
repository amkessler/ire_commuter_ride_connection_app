create table if not exists public.ride_saves (
  group_id uuid not null references public.ride_groups(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  saved_slots text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, participant_id)
);

alter table public.ride_saves enable row level security;

drop policy if exists "Users can view their own saved rides" on public.ride_saves;
create policy "Users can view their own saved rides"
on public.ride_saves for select
to authenticated
using (public.user_owns_participant(participant_id));

revoke all on public.ride_saves from public, anon, authenticated;
grant select on public.ride_saves to authenticated;

create or replace function public.save_ride_for_later(
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
  participant_to_save public.participants%rowtype;
  allowed_slots text[];
  selected_slots text[];
  already_matched_slots text[];
  wants_carpool_seat boolean;
  wants_rideshare boolean;
  offers_carpool boolean;
begin
  select *
  into target_group
  from public.ride_groups
  where id = p_group_id;

  if target_group.id is null then
    raise exception 'ride group not found';
  end if;

  select *
  into participant_to_save
  from public.participants
  where id = p_participant_id;

  if participant_to_save.id is null then
    raise exception 'participant not found';
  end if;

  if not public.user_owns_participant(p_participant_id) then
    raise exception 'not allowed';
  end if;

  if target_group.host_participant_id = p_participant_id then
    raise exception 'cannot save your own ride post';
  end if;

  if p_slot_ids is null or cardinality(p_slot_ids) = 0 then
    delete from public.ride_saves
    where group_id = p_group_id
      and participant_id = p_participant_id;
    return;
  end if;

  wants_carpool_seat :=
    participant_to_save.intent = 'need-seat'
    or (participant_to_save.intent = 'both' and participant_to_save.seats_needed > 0)
    or (
      participant_to_save.transport_preference in ('carpool', 'either')
      and participant_to_save.seats_needed > 0
    );

  wants_rideshare :=
    participant_to_save.intent = 'split-rideshare'
    or participant_to_save.intent = 'both'
    or participant_to_save.transport_preference in ('rideshare', 'either');

  offers_carpool :=
    participant_to_save.intent in ('offer', 'both')
    and participant_to_save.transport_preference <> 'rideshare'
    and participant_to_save.seats_available > 0;

  if target_group.type = 'carpool' then
    if not wants_carpool_seat then
      raise exception 'participant does not need a carpool seat';
    end if;
  elsif target_group.type = 'carpool-request' then
    if not offers_carpool then
      raise exception 'participant cannot offer carpool help';
    end if;
  elsif target_group.type = 'rideshare' then
    if not wants_rideshare then
      raise exception 'participant is not looking for rideshare';
    end if;
  else
    raise exception 'unsupported ride group type';
  end if;

  allowed_slots := private.availability_overlap_slots(target_group.availability, participant_to_save.availability);
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

  insert into public.ride_saves (group_id, participant_id, saved_slots)
  values (p_group_id, p_participant_id, selected_slots)
  on conflict (group_id, participant_id) do update
  set saved_slots = excluded.saved_slots,
      updated_at = now();
end;
$$;

revoke execute on function public.save_ride_for_later(uuid, uuid, text[]) from public, anon;
grant execute on function public.save_ride_for_later(uuid, uuid, text[]) to authenticated;
