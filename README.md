# IRE Commuter Ride Connection App

React/Vite app for coordinating conference rides to National Harbor, Maryland from DC, Virginia, and Maryland. The current app keeps the richer matching model but presents it as a lighter connection board for attendee use and stakeholder review.

## Current Product Shape

The app has two primary areas:

- `Your plan`: one form where a signed-in attendee creates, edits, or removes their single ride profile.
- `Likely matches`: a compact list of relevant carpool offers, carpool requests, and Uber/Lyft split groups.

Users can open the `How to use this app` modal for a short guide without cluttering the main board. Signed-out users see clearly labeled sample data and can return to sample mode if they start sign-in and change their mind. Signed-in users can reveal email or phone details when they want to reach someone, mark that contact or a help offer happened, and then mark a match only after there has been mutual agreement. Sign-in, saved ride-plan details, prototype preview tools, and card history stay collapsed until needed. The UI deliberately avoids letting someone instantly commit to another attendee's ride without prior contact.

The workflow rules are:

- Carpool drivers can mark final matches for their own carpool offers.
- For carpool requests, a potential helper must mark that they offered help before the request can be marked matched.
- For Uber/Lyft split groups, either the organizer or the contacted participant can mark the group matched after contact is recorded.
- The database still stores `committed` as the final status value, but the current UI presents that state as `matched`.

## Core Data Model

`participant`

- `name`, `email`, `phone`
- `neighborhood`
- `corridor`: regional route zone such as `dc-nw`, `dc-ne`, `arlington-alexandria`, `fairfax-falls-church`, `woodbridge-springfield`, `silver-spring-takoma`, `bethesda-rockville`, `pg-county`
- `intent`: `offer`, `need-seat`, `split-rideshare`, or `both`
- `transportPreference`: `carpool`, `rideshare`, or `either`
- `seatsAvailable`, `seatsNeeded`, and `maxPartySize`
- `availability`: booleans for Thursday AM/PM, Friday AM/PM, Saturday AM/PM, Sunday AM/PM
- `notes`: visible to signed-in users on matching ride cards; users should not put private or sensitive information here

`rideGroup`

- `type`: `carpool`, `carpool-request`, or `rideshare`
- `hostId`
- `riderIds`
- `corridor`
- `routeFlexibility`: `tight`, `moderate`, or `flexible`
- `capacity`
- `status`: `open`, `pending`, `committed`, or `full`
- `availability`
- `inquiries`: participant IDs that have marked contact or offered help. This is an internal database name; the current UI presents it as contact tracking.

## Matching Logic

The app scores possible pairings internally, then shows users plain categories such as `Strong match`, `Good match`, `Possible match`, or `Weak match`. The internal score uses:

1. Shared trip slots.
2. Regional corridor match.
3. Corridor adjacency for nearby areas.
4. Mode fit: carpool seekers match driver offers; drivers can respond to carpool requests; rideshare split seekers match rideshare pools.
5. Route flexibility: driver carpools penalize off-route requests more than Uber/Lyft split groups.
6. Capacity and status: full or matched rides can remain visible but are ranked below open options.

The route model is intentionally approximate. A production version should geocode submitted neighborhoods and evaluate actual pickup detour time with a maps API.

## Run

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

If npm is configured for a private registry on your machine, install with a one-command public registry override:

```bash
npm_config_registry=https://registry.npmjs.org/ npm install
```

## Deployment

Production is hosted on Vercel:

```text
https://ire-ride-connection-app.vercel.app
```

The Vercel project was created from the CLI and is not currently connected to the GitLab repository for automatic deploys. Deploy manually from this directory with `vercel --prod` only when a deployment has been explicitly requested.

## Supabase

This app is linked to the Supabase project `ire_commuter_rides`.

Local browser config belongs in `.env.local`:

```bash
VITE_SUPABASE_URL=https://jihvnicnexakeyyxeyad.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

Apply database changes:

```bash
supabase db push --dry-run
supabase db push
supabase migration list
```

Security checks:

```bash
supabase db advisors --linked --type security --level info
```

The app intentionally exposes authenticated RPCs for narrow server-side actions: `get_my_role`, `request_join_ride`, `commit_to_ride`, and admin moderation helpers. `request_join_ride` records that contact/help was initiated, while `commit_to_ride` requires that prior contact marker and enforces the contact-first match rules. Both ride-action RPCs validate participant/group compatibility, ownership or admin permission, full groups, self-matches, and already-matched participants before changing data. Supabase's advisor will warn that these are security-definer functions callable by signed-in users; keep that warning in context and inspect the function bodies before changing grants.

The app also includes a `send-ride-notification` Supabase Edge Function. After `request_join_ride` succeeds, the frontend calls this function on a best-effort basis. The function verifies the signed-in requester, confirms the inquiry exists, creates one `ride_notification_events` row per requester/post pair, and sends a minimal Resend email telling the post owner to sign in and review the possible match. Notification failures do not undo the contact marker.

Regular users sign in by email one-time code. The hosted Supabase email templates must send `{{ .Token }}` instead of a magic sign-in link. Supabase uses the `Magic Link / OTP` template for returning passwordless users and the `Confirm signup` template for first-time users, so both templates need to be configured for codes.

Email code checklist:

1. Open Supabase dashboard for `ire_commuter_rides`.
2. Go to `Authentication` -> `URL Configuration`.
3. Set the production site URL to `https://ire-ride-connection-app.vercel.app`.
4. Add redirect URLs for production and local testing, including `https://ire-ride-connection-app.vercel.app`, `http://localhost:5173`, and `http://localhost:3000` if older local auth links need to be tested.
5. Go to `Authentication` -> `Emails`.
6. Open `Magic Link / OTP` and confirm the template includes `{{ .Token }}` and does not rely on `{{ .ConfirmationURL }}`.
7. Open `Confirm signup` and confirm that first-time users also receive `{{ .Token }}` instead of a confirmation link.
8. Send a test login email for both a new email address and a returning email address, then verify the received code works in the app's `One-time code` field.

Ride notification checklist:

1. Confirm the Supabase Edge Function secret `RESEND_API_KEY` is set.
2. Optionally set `RIDE_NOTIFICATION_FROM` if the sender should differ from `IRE Commuter Ride Connection <rides@send.aaronmkessler.com>`.
3. Optionally set `RIDE_APP_URL` if the production app URL changes.
4. Deploy `send-ride-notification` after code changes.
5. Test by signing in as one user, recording contact/help on another user's post, and confirming the post owner receives one email.
6. Check `public.ride_notification_events` for `sent`, `skipped`, or `failed` status if a user reports a missing alert.

Admins are controlled by `public.admin_users`. The user must sign in once before they can be
made an admin, because that first sign-in creates their Supabase Auth user record.

Add an admin by email:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where email = 'person@example.com'
on conflict do nothing;
```

Replace `person@example.com` with the email they use to sign in. Have the user sign out and sign
back in after this change.

Remove admin access by email:

```sql
delete from public.admin_users
where user_id in (
  select id
  from auth.users
  where email = 'person@example.com'
);
```

Admin users see the MFA setup/verification panel when signed in. After MFA is verified, admins can use the participant switcher for troubleshooting. Regular signed-in users see only their own ride profile as the matching perspective.

Admin role and MFA behavior:

- `get_my_role()` returns whether the current account is listed in `public.admin_users`.
- RLS admin access is stricter: admin-only policies call private helper functions that require both admin membership and an MFA-verified `aal2` session.
- Returning admins can verify an existing authenticator code in the app.
- First-time admins can enroll a TOTP factor from the app.

Ride group duplicate prevention:

- Each participant can host at most one carpool offer group, one carpool request group, and one rideshare group.
- Updating a profile upserts the relevant hosted groups instead of inserting duplicate groups.
