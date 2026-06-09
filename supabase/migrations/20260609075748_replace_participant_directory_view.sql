drop view if exists public.participant_directory;

create table if not exists public.participant_directory (
  id uuid primary key references public.participants(id) on delete cascade,
  name text not null,
  neighborhood text not null,
  corridor text not null,
  intent text not null,
  transport_preference text not null,
  seats_available integer not null default 0,
  max_party_size integer not null default 3,
  availability jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

insert into public.participant_directory (
  id,
  name,
  neighborhood,
  corridor,
  intent,
  transport_preference,
  seats_available,
  max_party_size,
  availability,
  notes,
  created_at,
  updated_at
)
select
  id,
  name,
  neighborhood,
  corridor,
  intent,
  transport_preference,
  seats_available,
  max_party_size,
  availability,
  notes,
  created_at,
  updated_at
from public.participants
on conflict (id) do update
set
  name = excluded.name,
  neighborhood = excluded.neighborhood,
  corridor = excluded.corridor,
  intent = excluded.intent,
  transport_preference = excluded.transport_preference,
  seats_available = excluded.seats_available,
  max_party_size = excluded.max_party_size,
  availability = excluded.availability,
  notes = excluded.notes,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

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
    seats_available = excluded.seats_available,
    max_party_size = excluded.max_party_size,
    availability = excluded.availability,
    notes = excluded.notes,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists sync_participant_directory_after_write on public.participants;
create trigger sync_participant_directory_after_write
after insert or update or delete on public.participants
for each row execute function public.sync_participant_directory();

alter table public.participant_directory enable row level security;

drop policy if exists "Authenticated users can view participant directory" on public.participant_directory;
create policy "Authenticated users can view participant directory"
on public.participant_directory for select
to authenticated
using (true);

revoke all on public.participant_directory from public, anon;
grant select on public.participant_directory to authenticated;
revoke execute on function public.sync_participant_directory() from public, anon, authenticated;
