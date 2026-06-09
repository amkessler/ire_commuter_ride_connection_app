with ranked_groups as (
  select
    id,
    first_value(id) over (
      partition by host_participant_id, type
      order by created_at, id
    ) as keeper_id,
    row_number() over (
      partition by host_participant_id, type
      order by created_at, id
    ) as duplicate_rank
  from public.ride_groups
),
moved_memberships as (
  insert into public.ride_memberships (group_id, participant_id, created_at)
  select
    ranked_groups.keeper_id,
    ride_memberships.participant_id,
    min(ride_memberships.created_at)
  from public.ride_memberships
  join ranked_groups on ranked_groups.id = ride_memberships.group_id
  where ranked_groups.duplicate_rank > 1
  group by ranked_groups.keeper_id, ride_memberships.participant_id
  on conflict (group_id, participant_id) do nothing
  returning 1
),
moved_inquiries as (
  insert into public.ride_inquiries (group_id, participant_id, created_at)
  select
    ranked_groups.keeper_id,
    ride_inquiries.participant_id,
    min(ride_inquiries.created_at)
  from public.ride_inquiries
  join ranked_groups on ranked_groups.id = ride_inquiries.group_id
  where ranked_groups.duplicate_rank > 1
  group by ranked_groups.keeper_id, ride_inquiries.participant_id
  on conflict (group_id, participant_id) do nothing
  returning 1
)
delete from public.ride_groups
where id in (
  select id
  from ranked_groups
  where duplicate_rank > 1
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ride_groups_one_type_per_host'
      and conrelid = 'public.ride_groups'::regclass
  ) then
    alter table public.ride_groups
      add constraint ride_groups_one_type_per_host unique (host_participant_id, type);
  end if;
end $$;
