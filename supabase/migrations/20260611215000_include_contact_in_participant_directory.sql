alter table public.participant_directory
add column if not exists email text,
add column if not exists phone text;

update public.participant_directory as directory
set
  email = participants.email,
  phone = participants.phone
from public.participants
where participants.id = directory.id;

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
    email,
    phone,
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
    new.email,
    new.phone,
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
    email = excluded.email,
    phone = excluded.phone,
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
