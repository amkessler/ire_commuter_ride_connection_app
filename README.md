# IRE Ride Connection App

React/Vite prototype for coordinating conference rides to National Harbor, Maryland from DC, Virginia, and Maryland.

## Product Plan

### Goal

Create a practical coordination board where IRE attendees can:

- Post whether they are offering a carpool seat, looking for a carpool seat, or looking to split an Uber/Lyft.
- Declare their neighborhood, regional corridor, trip availability, and contact details.
- See potential matches that are realistic for the route to National Harbor.
- Track whether a ride is still open, filling, pending, committed, or full.
- Distinguish between tighter driver route constraints and more flexible rideshare split matches.

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

### Recommended Build Phases

1. Prototype: local state, sample records, manual add/list/match/status tools.
2. Shared data: wire records to Google Sheets, Airtable, or Supabase with basic auth.
3. Route intelligence: add geocoding and detour estimates for National Harbor routes.
4. Coordination safety: add private contact reveal, moderation, expiration, and update reminders.
5. Admin workflow: add organizer review tools, duplicate detection, and export.

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
