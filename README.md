# IRE Commuter Ride Connection App

React/Vite app for coordinating conference rides to National Harbor, Maryland from DC, Virginia, and Maryland. The current app keeps the richer matching model but presents it as a lighter connection board for attendee use and stakeholder review.

## Current Product Shape

The app has three primary areas:

- `Your plan`: one form where a signed-in attendee creates, edits, or removes their hosted ride posts while keeping profile/contact details for future edits.
- `Likely matches`: a compact list of relevant carpool offers, carpool requests, and Uber/Lyft split groups.
- `Your ride activity`: a signed-in summary of pending contacts, people the user contacted, and confirmed matches.

Users can open the `How to use this app` modal for a short guide without cluttering the main board. Signed-out users see clearly labeled sample data and can return to sample mode if they start sign-in and change their mind. Signed-in users can save posts privately, reveal email or phone details when they want to reach someone, mark that contact or a help offer happened for specific conference trip slots, and then mark only the mutually agreed slots as matched. Sign-in, saved ride-plan details, prototype preview tools, and card history stay collapsed until needed. The UI deliberately avoids letting someone instantly commit to another attendee's ride without prior contact.

Contact reveal is a user-experience step, not a database privacy boundary. In the current attendee-board version, visible authenticated `participant_directory` rows include email/phone fields so signed-in attendees can coordinate directly outside the app.

The workflow rules are:

- Contact interest is per slot. A user can record interest in `Thu AM` and `Thu PM` without recording interest in `Fri AM`.
- Saved rides are per slot. A user can privately save the open slots they may want to revisit without alerting the post owner.
- Final matching is also per slot. A driver or organizer can mark only `Thu AM` as matched and leave `Thu PM` pending.
- When a post's availability changes, stale saved, pending, and matched slots that no longer belong to the post are pruned in the database.
- Route, mode, and schedule fit are advisory. Non-fit cards show a `Not a fit` warning but still expose the normal save/contact flow when the post has open slots.
- Carpool drivers can mark final matches for their own carpool offers.
- For carpool requests, a potential helper must mark that they offered help before the request can be marked matched.
- For Uber/Lyft split groups, either the organizer or the contacted participant can mark the group matched after contact is recorded.
- The database still stores `committed` as the final status value, but the current UI presents that state as `matched`.
- Manually setting a post to `full` closes it even if slot-level capacity would otherwise have open spots. It must be reopened before save/contact/match actions can proceed.

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
- `inquirySlotsByParticipant`: app-shaped map of participant ID to pending contact slots, sourced from `ride_inquiries.interest_slots`.
- `savedByParticipant`: participant IDs that privately saved the post.
- `savedSlotsByParticipant`: app-shaped map of participant ID to saved slots, sourced from `ride_saves.saved_slots`.
- `matchedSlotsByParticipant`: app-shaped map of participant ID to confirmed slots, sourced from `ride_memberships.matched_slots`.

In Supabase:

- `ride_inquiries.interest_slots` stores the selected pending contact/help slots.
- `ride_saves.saved_slots` stores the selected private saved-post slots.
- `ride_memberships.matched_slots` stores the selected confirmed match slots.
- `save_ride_for_later(p_group_id, p_participant_id, p_slot_ids)` validates and records private saved slots.
- `request_join_ride(p_group_id, p_participant_id, p_slot_ids)` validates and records pending contact/help slots.
- `commit_to_ride(p_group_id, p_participant_id, p_slot_ids)` validates that the slots were previously pending, records only those matched slots, and leaves unselected pending slots in place.

Capacity is evaluated by slot. A carpool with one open seat can be full for `Thu AM` but still open for `Fri AM`. Manual `full` status overrides computed capacity and closes the post until changed back to an active status.

## Matching Logic

The app scores pairings internally, then shows users plain categories such as `Strong match`, `Good match`, `Possible match`, or `Weak match`. These labels affect ordering and warnings, not whether a user is allowed to save or contact a post. The internal score uses:

1. Shared trip slots.
2. Regional corridor match.
3. Corridor adjacency for nearby areas.
4. Mode fit: carpool seekers match driver offers; drivers can respond to carpool requests; rideshare split seekers match rideshare pools.
5. Route flexibility: driver carpools penalize off-route requests more than Uber/Lyft split groups.
6. Capacity and status: full or matched rides can remain visible but are ranked below open options.

If a card is outside the viewer's current route, mode, or trip-slot plan, it shows a `Not a fit` warning while leaving the normal save/contact controls available for open slots. This keeps the workflow flexible for real-world cases such as a rider meeting a driver at a halfway point.

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

The app intentionally exposes authenticated RPCs for narrow server-side actions: `get_my_role`, `save_ride_for_later`, `request_join_ride`, `commit_to_ride`, and admin moderation helpers. `save_ride_for_later` records private saved slots, `request_join_ride` records that contact/help was initiated for selected slots, and `commit_to_ride` requires that prior contact marker and enforces the contact-first match rules for the selected slots. Ride fit is not a database hard gate; the current RPCs permit flexible non-fit actions for open slots. They still validate ownership or admin permission, manual full status, active selected slots, slot-level capacity, self-actions, already-matched slots, and pending-slot requirements before changing data. Supabase's advisor will warn that these are security-definer functions callable by signed-in users; keep that warning in context and inspect the function bodies before changing grants.

Current slot-state protection is in `20260612183000_prune_stale_slots_and_preserve_profiles.sql`. That migration prunes stale `ride_inquiries.interest_slots`, `ride_saves.saved_slots`, and `ride_memberships.matched_slots` after ride-group availability changes, rejects matching inactive pending slots, and preserves manual `full` as a hard closed state.

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
- Removing a user's own post or using the admin remove-post helper deletes hosted ride groups, not the participant profile row. The profile/contact details remain available to prefill a future post.

## Per-Slot Workflow Test

Use this smoke test after changing contact, match, or capacity logic:

1. Account A creates a carpool offer with `Thu AM`, `Thu PM`, and `Fri AM`.
2. Account B creates a compatible carpool request with the same slots.
3. Account B reveals contact info and records interest only in `Thu AM` and `Thu PM`.
4. Confirm `ride_inquiries.interest_slots` contains only `thuAm` and `thuPm`.
5. Account A marks only `Thu AM` as matched.
6. Confirm `ride_memberships.matched_slots` contains only `thuAm`.
7. Confirm `ride_inquiries.interest_slots` still contains `thuPm`.
8. Confirm `Fri AM` is not treated as contacted or matched.
9. Confirm the card can show a split state such as `Matched: Thu AM; pending: Thu PM`.
10. Confirm a non-fit post with open slots shows a `Not a fit` warning while still offering `Save`, contact reveal buttons, and the normal record-contact/help action after contact is revealed.
11. Confirm saving a non-fit post writes only the selected open slots to `ride_saves.saved_slots`.
12. Edit a post to remove one previously saved/contacted/matched slot and confirm Supabase prunes that stale slot from saves, inquiries, and memberships.
13. Mark a post `Full` manually and confirm save/contact/match actions are blocked until the post is reopened.
14. As an MFA-verified admin, remove a post and confirm the hosted ride groups disappear while the participant row remains.
