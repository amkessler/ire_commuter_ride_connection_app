create or replace function private.group_has_open_spots_for_slots(group_uuid uuid, selected_slots text[])
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  with target_group as (
    select private.availability_active_slots(availability) as active_slots
    from public.ride_groups
    where id = group_uuid
  )
  select coalesce(
    bool_and(
      selected_slot = any(target_group.active_slots)
      and private.group_slot_open_spots(group_uuid, selected_slot) > 0
    ),
    false
  )
  from unnest(coalesce(selected_slots, array[]::text[])) as selected_slot
  cross join target_group;
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
    when status = 'full' then 'full'
    when next_open_spots <= 0 then 'full'
    when has_memberships then 'committed'
    when has_inquiries then 'pending'
    else 'open'
  end
  where id = group_uuid;
end;
$$;

create or replace function private.prune_group_slot_state(group_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  active_slots text[];
begin
  select private.availability_active_slots(availability)
  into active_slots
  from public.ride_groups
  where id = group_uuid;

  if active_slots is null then
    return;
  end if;

  update public.ride_inquiries
  set interest_slots = private.normalize_slot_selection(interest_slots, active_slots)
  where group_id = group_uuid;

  delete from public.ride_inquiries
  where group_id = group_uuid
    and cardinality(interest_slots) = 0;

  update public.ride_memberships
  set matched_slots = private.normalize_slot_selection(matched_slots, active_slots)
  where group_id = group_uuid;

  delete from public.ride_memberships
  where group_id = group_uuid
    and cardinality(matched_slots) = 0;

  update public.ride_saves
  set saved_slots = private.normalize_slot_selection(saved_slots, active_slots),
      updated_at = now()
  where group_id = group_uuid;

  delete from public.ride_saves
  where group_id = group_uuid
    and cardinality(saved_slots) = 0;

  perform private.set_ride_group_status_from_activity(group_uuid);
end;
$$;

create or replace function public.prune_ride_group_slot_state_after_availability_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.availability is distinct from old.availability then
    perform private.prune_group_slot_state(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists prune_ride_group_slot_state_after_availability_update on public.ride_groups;
create trigger prune_ride_group_slot_state_after_availability_update
after update of availability on public.ride_groups
for each row execute function public.prune_ride_group_slot_state_after_availability_update();

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

  if target_group.status = 'full' then
    raise exception 'ride group is full';
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

  if target_group.status = 'full' then
    raise exception 'ride group is full';
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

  insert into public.ride_saves (group_id, participant_id, saved_slots)
  values (p_group_id, p_participant_id, selected_slots)
  on conflict (group_id, participant_id) do update
  set saved_slots = excluded.saved_slots,
      updated_at = now();
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
  active_slots text[];
  active_pending_slots text[];
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

  if target_group.status = 'full' then
    raise exception 'ride group is full';
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

  active_slots := private.availability_active_slots(target_group.availability);
  active_pending_slots := private.normalize_slot_selection(pending_inquiry.interest_slots, active_slots);

  if cardinality(active_pending_slots) = 0 then
    delete from public.ride_inquiries
    where group_id = p_group_id
      and participant_id = p_participant_id;
    perform private.set_ride_group_status_from_activity(p_group_id);
    raise exception 'no active pending conference slots remain for this post';
  end if;

  selected_slots := private.normalize_slot_selection(p_slot_ids, active_pending_slots);

  if cardinality(selected_slots) = 0 then
    raise exception 'choose at least one active pending conference slot';
  end if;

  if not private.group_has_open_spots_for_slots(p_group_id, selected_slots) then
    raise exception 'one or more selected slots are full';
  end if;

  insert into public.ride_memberships (group_id, participant_id, matched_slots)
  values (p_group_id, p_participant_id, selected_slots)
  on conflict (group_id, participant_id) do update
  set matched_slots = private.slot_array_union(ride_memberships.matched_slots, excluded.matched_slots);

  remaining_interest_slots := private.slot_array_without(active_pending_slots, selected_slots);

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

create or replace function public.admin_remove_participant_post(
  p_participant_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_participant public.participants%rowtype;
  hosted_group_ids uuid[];
  actor_id uuid;
begin
  if not private.has_admin_access() then
    raise exception 'admin MFA verification required';
  end if;

  actor_id := (select auth.uid());

  select *
  into target_participant
  from public.participants
  where id = p_participant_id;

  if target_participant.id is null then
    raise exception 'participant not found';
  end if;

  select coalesce(array_agg(id order by created_at), array[]::uuid[])
  into hosted_group_ids
  from public.ride_groups
  where host_participant_id = p_participant_id;

  if cardinality(hosted_group_ids) = 0 then
    raise exception 'participant has no hosted ride posts';
  end if;

  insert into public.admin_activity_log (
    actor_user_id,
    action,
    target_user_id,
    target_participant_id,
    details
  )
  values (
    actor_id,
    'remove_post',
    target_participant.user_id,
    target_participant.id,
    jsonb_build_object(
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'participant', to_jsonb(target_participant),
      'hosted_group_ids', hosted_group_ids
    )
  );

  delete from public.ride_groups
  where host_participant_id = p_participant_id;
end;
$$;

do $$
declare
  ride_group record;
begin
  for ride_group in
    select id
    from public.ride_groups
  loop
    perform private.prune_group_slot_state(ride_group.id);
  end loop;
end;
$$;

revoke execute on function public.prune_ride_group_slot_state_after_availability_update() from public, anon, authenticated;
grant execute on function public.request_join_ride(uuid, uuid, text[]) to authenticated;
grant execute on function public.save_ride_for_later(uuid, uuid, text[]) to authenticated;
grant execute on function public.commit_to_ride(uuid, uuid, text[]) to authenticated;
grant execute on function public.admin_remove_participant_post(uuid, text) to authenticated;
