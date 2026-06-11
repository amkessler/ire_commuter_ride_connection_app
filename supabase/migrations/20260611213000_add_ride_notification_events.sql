create table if not exists public.ride_notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'ride_inquiry' check (event_type in ('ride_inquiry')),
  group_id uuid not null,
  requester_participant_id uuid not null,
  recipient_participant_id uuid not null,
  requester_user_id uuid references auth.users(id) on delete set null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  email_provider text not null default 'resend',
  provider_message_id text,
  error_message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (event_type, group_id, requester_participant_id, recipient_participant_id)
);

drop trigger if exists touch_ride_notification_events_updated_at on public.ride_notification_events;
create trigger touch_ride_notification_events_updated_at
before update on public.ride_notification_events
for each row execute function public.touch_updated_at();

alter table public.ride_notification_events enable row level security;

drop policy if exists "Admins can view ride notification events" on public.ride_notification_events;
create policy "Admins can view ride notification events"
on public.ride_notification_events for select
to authenticated
using (private.has_admin_access());

revoke all on public.ride_notification_events from public, anon, authenticated;
grant select on public.ride_notification_events to authenticated;
