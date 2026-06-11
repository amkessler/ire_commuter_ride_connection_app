alter table public.participants
  drop constraint if exists participants_corridor_check;

alter table public.participants
  add constraint participants_corridor_check
  check (
    corridor in (
      'dc-nw',
      'dc-ne',
      'arlington-alexandria',
      'fairfax-falls-church',
      'woodbridge-springfield',
      'silver-spring-takoma',
      'bethesda-rockville',
      'pg-county'
    )
  );

alter table public.ride_groups
  drop constraint if exists ride_groups_corridor_check;

alter table public.ride_groups
  add constraint ride_groups_corridor_check
  check (
    corridor in (
      'dc-nw',
      'dc-ne',
      'arlington-alexandria',
      'fairfax-falls-church',
      'woodbridge-springfield',
      'silver-spring-takoma',
      'bethesda-rockville',
      'pg-county'
    )
  );
