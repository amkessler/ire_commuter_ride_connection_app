alter table public.participants
drop constraint if exists participants_max_party_size_check;

alter table public.participants
add constraint participants_max_party_size_check
check (max_party_size >= 0 and max_party_size <= 6);
