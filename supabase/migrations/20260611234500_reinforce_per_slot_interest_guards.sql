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

grant execute on function public.request_join_ride(uuid, uuid, text[]) to authenticated;
