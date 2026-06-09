# IRE Ride Connection App

React/Vite app for coordinating conference rides to National Harbor, Maryland from DC, Virginia, and Maryland. The `simple_version` branch keeps the richer matching model but presents it as a lighter connection board for stakeholder review.

## Current Product Shape

The app has two primary areas:

- `Your plan`: one form where a signed-in attendee creates or edits their single ride profile.
- `Likely matches`: a compact list of relevant carpool offers, carpool requests, and Uber/Lyft split groups.

Users can reveal email or phone details when they want to reach someone, mark that contact or a help offer happened, and then mark a match only after there has been mutual agreement. The UI deliberately avoids letting someone instantly commit to another attendee's ride without prior contact.

The workflow rules are:

- Carpool drivers can mark final matches for their own carpool offers.
- For carpool requests, a potential helper must mark that they offered help before the request can be marked matched.
- For Uber/Lyft split groups, either the organizer or the contacted participant can mark the group matched after contact is recorded.
- The database still stores `committed` as the final status value, but the simple UI presents that state as `matched`.

## Core Data Model

`participant`

- `name`, `email`, `phone`
- `neighborhood`
- `corridor`: regional route zone such as `dc-nw`, `dc-ne`, `arlington-alexandria`, `silver-spring-takoma`, `bethesda-rockville`, `pg-county`, `fairfax-falls-church`
- `intent`: `offer`, `need-seat`, `split-rideshare`, `offer-or-split`, or `need-or-split`
- `transportPreference`: `carpool`, `rideshare`, or `either`
- `seatsAvailable`, `seatsNeeded`, and `maxPartySize`
- `availability`: booleans for Thursday AM/PM, Friday AM/PM, Saturday AM/PM, Sunday AM/PM
- `notes`

`rideGroup`

- `type`: `carpool`, `carpool-request`, or `rideshare`
- `hostId`
- `riderIds`
- `corridor`
- `routeFlexibility`: `tight`, `moderate`, or `flexible`
- `capacity`
- `status`: `open`, `pending`, `committed`, or `full`
- `availability`
- `inquiries`: participant IDs that have marked contact or offered help. This is an internal database name; the simple UI presents it as contact tracking.

## Matching Logic

The prototype scores possible pairings using:

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

The app intentionally exposes three authenticated RPCs: `get_my_role`, `request_join_ride`, and `commit_to_ride`. `request_join_ride` records that contact/help was initiated, while `commit_to_ride` requires that prior contact marker and enforces the simple-version match rules. Supabase's advisor will warn that these are security-definer functions callable by signed-in users; keep that warning in context and inspect the function bodies before changing grants.

Regular users sign in by email one-time code. The hosted Supabase email template has been updated through the Management API to send `{{ .Token }}` instead of a magic sign-in link.

Email code checklist:

1. Open Supabase dashboard for `ire_commuter_rides`.
2. Go to `Authentication` -> `Emails`.
3. Open the confirmation/login email template used by passwordless email sign-in.
4. Confirm the Magic Link / OTP template includes `{{ .Token }}` and does not rely on `{{ .ConfirmationURL }}`.
5. Send a test login email and verify the received code works in the app's `One-time code` field.

Admins are controlled by `public.admin_users`. Add an admin by inserting that user's auth UUID:

```sql
insert into public.admin_users (user_id)
values ('00000000-0000-0000-0000-000000000000');
```

Admin users see the participant switcher and MFA setup panel. Regular signed-in users see only their own ride profile as the matching perspective.

Admin role and MFA behavior:

- `get_my_role()` returns whether the current account is listed in `public.admin_users`.
- RLS admin access is stricter: admin-only policies call private helper functions that require both admin membership and an MFA-verified `aal2` session.
- Returning admins can verify an existing authenticator code in the app.
- First-time admins can enroll a TOTP factor from the app.

Ride group duplicate prevention:

- Each participant can host at most one carpool offer group, one carpool request group, and one rideshare group.
- Updating a profile upserts the relevant hosted groups instead of inserting duplicate groups.
