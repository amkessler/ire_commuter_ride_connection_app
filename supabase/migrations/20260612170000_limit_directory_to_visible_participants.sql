drop policy if exists "Authenticated users can view participant directory" on public.participant_directory;

create policy "Authenticated users can view participant directory"
on public.participant_directory for select
to authenticated
using (
  public.user_owns_participant(participant_directory.id)
  or private.has_admin_access()
  or exists (
    select 1
    from public.ride_groups
    where ride_groups.host_participant_id = participant_directory.id
  )
  or exists (
    select 1
    from public.ride_inquiries
    where ride_inquiries.participant_id = participant_directory.id
  )
  or exists (
    select 1
    from public.ride_memberships
    where ride_memberships.participant_id = participant_directory.id
  )
);
