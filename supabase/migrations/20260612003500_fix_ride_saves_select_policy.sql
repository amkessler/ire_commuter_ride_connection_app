drop policy if exists "Users can view their own saved rides" on public.ride_saves;

create policy "Users can view their own saved rides"
on public.ride_saves for select
to authenticated
using (
  exists (
    select 1
    from public.participants
    where participants.id = ride_saves.participant_id
      and participants.user_id = (select auth.uid())
  )
);
