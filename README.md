# IRE Ride Connection App

React/Vite app for coordinating conference rides to National Harbor, Maryland from DC, Virginia, and Maryland. It supports signed-out sample mode for demos and Supabase-backed signed-in mode for shared data.

## Product Plan

### Goal

Create a practical coordination board where IRE attendees can:

- Post whether they are offering a carpool seat, looking for a carpool seat, or looking to split an Uber/Lyft.
- Declare their neighborhood, regional corridor, trip availability, and contact details.
- See potential matches that are realistic for the route to National Harbor.
- Track whether a ride is still open, filling, pending, committed, or full.
- Distinguish between tighter driver route constraints and more flexible rideshare split matches.

### Current Version

The app now includes:

- Four tabs: `Find rides`, `Add info`, `Route map`, and `Status`.
- Supabase Auth with email magic-link sign-in.
- Supabase Postgres tables for participants, public-safe participant directory rows, ride groups, memberships, inquiries, profiles, and admin users.
- Row-level security policies so regular users can manage their own profile while admins can troubleshoot after MFA.
- Admin MFA step-up: admin accounts can be recognized before MFA, but admin-only data/actions require an AAL2 session.
- A uniqueness rule that prevents duplicate ride groups when a participant updates their profile.
- Signed-out sample data and local storage fallback for prototype/demo use.

### Core Data Model

`participant`

- `name`, `email`, `phone`
- `neighborhood`
- `corridor`: regional route zone such as `dc-nw`, `dc-ne`, `arlington-alexandria`, `silver-spring-takoma`, `bethesda-rockville`, `pg-county`, `fairfax-falls-church`
- `intent`: `offer`, `need-seat`, `split-rideshare`, or `both`
- `transportPreference`: `carpool`, `rideshare`, or `either`
- `seatsAvailable` and `maxPartySize`
- `availability`: booleans for Thursday AM/PM, Friday AM/PM, Saturday AM/PM, Sunday AM
- `notes`

`rideGroup`

- `type`: driver carpool or rideshare split
- `hostId`
- `riderIds`
- `corridor`
- `routeFlexibility`: `tight`, `moderate`, or `flexible`
- `capacity`
- `status`: `open`, `pending`, `committed`, or `full`
- `availability`
- `inquiries`: participant IDs that have asked about the ride

### Matching Logic

The prototype scores each possible pairing using:

1. Shared trip slots.
2. Regional corridor match.
3. Corridor adjacency for nearby areas.
4. Mode fit: carpool seekers match driver offers; rideshare split seekers match rideshare pools.
5. Route flexibility: driver carpools penalize off-route requests more than Uber/Lyft split groups.
6. Capacity and status: full rides are visible but ranked below open or pending rides.

The route model is intentionally approximate for the prototype. A production version should geocode submitted neighborhoods and evaluate actual pickup detour time with a maps API.

### Recommended Next Phases

1. Route intelligence: add geocoding and detour estimates for National Harbor routes.
2. Coordination safety: add private contact reveal, moderation, expiration, and update reminders.
3. Admin workflow: add organizer review screens, exports, and duplicate/contact audit tools.
4. Communication: add host approval flows and optional notifications.
5. Deployment: connect the production URL, redirect settings, and any custom email provider.

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

The app intentionally exposes three authenticated RPCs: `get_my_role`, `request_join_ride`, and `commit_to_ride`. Supabase's advisor will warn that these are security-definer functions callable by signed-in users; keep that warning in context and inspect the function bodies before changing grants.

Regular users sign in by email magic link. The app also keeps an optional code-entry field for a future OTP setup, but the current free-tier Supabase project uses the default email provider, which does not allow hosted email template edits.

Magic-link checklist:

1. Open Supabase dashboard for `ire_commuter_rides`.
2. Go to `Authentication` -> `Emails`.
3. Open the confirmation/login email template used by passwordless email sign-in.
4. Keep `{{ .ConfirmationURL }}` in the email body for the magic-link flow.
5. Send a test login email and verify the sign-in link opens the app.

To use numeric one-time codes later, configure custom SMTP or move the Supabase project to a plan that permits hosted email template edits, then change the Magic Link / OTP template to include `{{ .Token }}`.

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

- Each participant can host at most one carpool group and one rideshare group.
- Updating a profile upserts the relevant hosted group instead of inserting another duplicate group.
