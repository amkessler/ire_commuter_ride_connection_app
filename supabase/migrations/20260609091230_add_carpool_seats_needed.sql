alter table public.participants
add column if not exists seats_needed integer not null default 1
check (seats_needed >= 0 and seats_needed <= 6);

alter table public.participant_directory
add column if not exists seats_needed integer not null default 1
check (seats_needed >= 0 and seats_needed <= 6);

update public.participants
set seats_needed = case
  when intent in ('need-seat', 'both') then 1
  else 0
end
where seats_needed = 1;

update public.participant_directory
set seats_needed = case
  when intent in ('need-seat', 'both') then 1
  else 0
end
where seats_needed = 1;

create or replace function public.sync_participant_directory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.participant_directory
    where id = old.id;
    return old;
  end if;

  insert into public.participant_directory (
    id,
    name,
    neighborhood,
    corridor,
    intent,
    transport_preference,
    seats_needed,
    seats_available,
    max_party_size,
    availability,
    notes,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.name,
    new.neighborhood,
    new.corridor,
    new.intent,
    new.transport_preference,
    new.seats_needed,
    new.seats_available,
    new.max_party_size,
    new.availability,
    new.notes,
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    name = excluded.name,
    neighborhood = excluded.neighborhood,
    corridor = excluded.corridor,
    intent = excluded.intent,
    transport_preference = excluded.transport_preference,
    seats_needed = excluded.seats_needed,
    seats_available = excluded.seats_available,
    max_party_size = excluded.max_party_size,
    availability = excluded.availability,
    notes = excluded.notes,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke execute on function public.sync_participant_directory() from public, anon, authenticated;
