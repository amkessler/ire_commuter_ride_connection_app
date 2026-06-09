insert into public.ride_groups (
  host_participant_id,
  type,
  corridor,
  route_flexibility,
  capacity,
  status,
  availability
)
select
  participants.id,
  'carpool-request',
  participants.corridor,
  'moderate',
  participants.seats_needed,
  'open',
  participants.availability
from public.participants
where participants.intent in ('need-seat', 'both')
  and participants.transport_preference <> 'rideshare'
  and participants.seats_needed > 0
  and not exists (
    select 1
    from public.ride_groups
    where ride_groups.host_participant_id = participants.id
      and ride_groups.type = 'carpool-request'
  );
