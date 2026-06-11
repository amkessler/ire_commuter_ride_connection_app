create or replace function public.request_join_ride(p_group_id uuid, p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_group public.ride_groups%rowtype;
  participant_to_request public.participants%rowtype;
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
  into participant_to_request
  from public.participants
  where id = p_participant_id;

  if participant_to_request.id is null then
    raise exception 'participant not found';
  end if;

  if not (
    private.has_admin_access()
    or participant_to_request.user_id = (select auth.uid())
  ) then
    raise exception 'not allowed';
  end if;

  if target_group.host_participant_id = p_participant_id then
    raise exception 'host is already in ride group';
  end if;

  if exists (
    select 1
    from public.ride_memberships
    where group_id = p_group_id
      and participant_id = p_participant_id
  ) then
    raise exception 'participant is already matched';
  end if;

  wants_carpool_seat :=
    participant_to_request.intent = 'need-seat'
    or (participant_to_request.intent = 'both' and participant_to_request.seats_needed > 0)
    or (
      participant_to_request.transport_preference in ('carpool', 'either')
      and participant_to_request.seats_needed > 0
    );

  wants_rideshare :=
    participant_to_request.intent = 'split-rideshare'
    or participant_to_request.intent = 'both'
    or participant_to_request.transport_preference in ('rideshare', 'either');

  offers_carpool :=
    participant_to_request.intent in ('offer', 'both')
    and participant_to_request.transport_preference <> 'rideshare'
    and participant_to_request.seats_available > 0;

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
  target_group public.ride_groups%rowtype;
  participant_to_match public.participants%rowtype;
  actor_is_group_host boolean;
  actor_owns_participant boolean;
  wants_carpool_seat boolean;
  wants_rideshare boolean;
  offers_carpool boolean;
  next_open_spots integer;
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

  if not exists (
    select 1
    from public.ride_inquiries
    where group_id = p_group_id
      and participant_id = p_participant_id
  ) then
    raise exception 'match requires an inquiry first';
  end if;

  if exists (
    select 1
    from public.ride_memberships
    where group_id = p_group_id
      and participant_id = p_participant_id
  ) then
    raise exception 'participant is already matched';
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

  if private.group_open_spots(p_group_id) <= 0 then
    raise exception 'ride group is full';
  end if;

  insert into public.ride_memberships (group_id, participant_id)
  values (p_group_id, p_participant_id);

  delete from public.ride_inquiries
  where group_id = p_group_id
    and participant_id = p_participant_id;

  next_open_spots := private.group_open_spots(p_group_id);

  update public.ride_groups
  set status = case when next_open_spots <= 0 then 'full' else 'committed' end
  where id = p_group_id;
end;
$$;

grant execute on function public.request_join_ride(uuid, uuid) to authenticated;
grant execute on function public.commit_to_ride(uuid, uuid) to authenticated;
