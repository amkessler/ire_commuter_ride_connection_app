create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (
    action in ('remove_post', 'update_group_status')
  ),
  target_user_id uuid references auth.users(id) on delete set null,
  target_participant_id uuid,
  target_group_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_activity_log enable row level security;

drop policy if exists "Admins can view admin activity log" on public.admin_activity_log;
create policy "Admins can view admin activity log"
on public.admin_activity_log for select
to authenticated
using (private.has_admin_access());

revoke all on public.admin_activity_log from public, anon, authenticated;
grant select on public.admin_activity_log to authenticated;

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

  delete from public.participants
  where id = p_participant_id;
end;
$$;

create or replace function public.admin_update_group_status(
  p_group_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_group public.ride_groups%rowtype;
  host_participant public.participants%rowtype;
  actor_id uuid;
begin
  if not private.has_admin_access() then
    raise exception 'admin MFA verification required';
  end if;

  if p_status not in ('open', 'pending', 'committed', 'full') then
    raise exception 'unsupported ride status';
  end if;

  actor_id := (select auth.uid());

  select *
  into target_group
  from public.ride_groups
  where id = p_group_id;

  if target_group.id is null then
    raise exception 'ride group not found';
  end if;

  select *
  into host_participant
  from public.participants
  where id = target_group.host_participant_id;

  update public.ride_groups
  set status = p_status
  where id = p_group_id;

  insert into public.admin_activity_log (
    actor_user_id,
    action,
    target_user_id,
    target_participant_id,
    target_group_id,
    details
  )
  values (
    actor_id,
    'update_group_status',
    host_participant.user_id,
    host_participant.id,
    target_group.id,
    jsonb_build_object(
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'old_status', target_group.status,
      'new_status', p_status,
      'group_type', target_group.type,
      'host_name', host_participant.name,
      'host_email', host_participant.email
    )
  );
end;
$$;

revoke execute on function public.admin_remove_participant_post(uuid, text) from public, anon;
revoke execute on function public.admin_update_group_status(uuid, text, text) from public, anon;
grant execute on function public.admin_remove_participant_post(uuid, text) to authenticated;
grant execute on function public.admin_update_group_status(uuid, text, text) to authenticated;
