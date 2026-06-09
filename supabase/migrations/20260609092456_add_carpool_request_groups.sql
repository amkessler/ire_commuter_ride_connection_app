alter table public.ride_groups
drop constraint if exists ride_groups_type_check;

alter table public.ride_groups
add constraint ride_groups_type_check
check (type in ('carpool', 'carpool-request', 'rideshare'));
