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

  if not public.user_owns_participant(p_participant_id) then
    raise exception 'not allowed';
  end if;

  if target_group.host_participant_id = p_participant_id then
    raise exception 'host is already in ride group';
  end if;

  allowed_slots := private.availability_active_slots(target_group.availability);
  selected_slots := private.normalize_slot_selection(p_slot_ids, allowed_slots);

  select coalesce(matched_slots, array[]::text[])
  into already_matched_slots
  from public.ride_memberships
  where group_id = p_group_id
    and participant_id = p_participant_id;

  selected_slots := private.slot_array_without(selected_slots, already_matched_slots);

  if cardinality(selected_slots) = 0 then
    raise exception 'choose at least one unmatched open conference slot';
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

  if target_group.type = 'carpool' then
    if not actor_is_group_host then
      raise exception 'only the carpool driver can mark a match';
    end if;
  elsif target_group.type = 'rideshare' then
    if not (actor_is_group_host or actor_owns_participant) then
      raise exception 'only people involved in this rideshare can mark a match';
    end if;
  elsif target_group.type = 'carpool-request' then
    if not actor_owns_participant then
      raise exception 'only the contacting participant can mark this request matched';
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
