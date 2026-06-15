# Plain Language Explainer: IRE Commuter Ride Connection

This project is a small React app for helping people coordinate rides to the IRE Conference in National Harbor, Maryland.

The original idea started as a Google Sheet. That made sense at first: a sheet is quick, familiar, and good for collecting names, neighborhoods, contact info, availability, and notes. But the problem became more than "put names in rows." The real problem is matching people in a way that respects geography, timing, capacity, and ride status.

A spreadsheet can tell you that Maya is offering two seats and Jon needs a ride. It cannot easily tell you whether Jon is reasonably on Maya's route, whether the car is already full, whether a ride is just being discussed, or whether a nearby Uber/Lyft group still has space. This app is the first version of a tool that can do those things.

Think of it less like a signup form and more like a connection board for conference commuting.

The current app is the intentionally calmer version of the ride connection idea. Earlier design work still informed the model, but this version focuses the interface around three practical areas: `Your plan`, `Likely matches`, and, for signed-in users, `Your ride activity`. It grew out of a stakeholder question: "What would this look like if we made the interface much simpler?"

People are not just entries. They are moving parts:

- Where are they starting?
- Are they driving, looking for a carpool seat, or trying to split an Uber/Lyft?
- When are they going to and from the conference?
- How many people are already matched?
- Is this ride open, pending, matched, or full?
- Would adding another person make the route unreasonable?

The app is built around those questions.

## What The App Does

At a high level, the app has four jobs.

First, it lets an attendee submit one ride profile. They can enter their name, contact details, neighborhood, regional corridor, availability, and whether they can drive, need a carpool seat, want to split an Uber/Lyft, or are open to one of the mixed options. Signed-in users can later edit their ride info or remove their hosted ride posts while keeping their profile details saved for a future post.

Second, it displays active ride options. These are shown as ride cards. A card might represent a driver carpool, where a person has a car and a fixed number of carpool seats. It might represent a carpool request, where someone needs a seat. Or it might represent a shared rideshare pool, where people are trying to split an Uber or Lyft.

Third, it helps users judge fit. The app scores potential matches internally based on timing, route corridor, ride type, status, and capacity, then shows plain categories such as `Strong match` or `Possible match`. A good match appears higher. A bad match, such as a driver having to make a major detour, gets pushed lower.

Fit is guidance, not a hard wall. If a post does not match someone's current plan, the card shows a `Not a fit` warning but still lets them save the post, reveal contact details, and record contact or a help offer when the post has open trip slots. That matters because real people may agree to flexible arrangements the scoring model cannot predict, such as meeting at a halfway point.

Fourth, it supports a more careful coordination flow. A user can save a post privately, reveal email or phone details, contact the other person outside the app, and then record that contact or help offer for specific conference trip slots. They cannot simply force themselves into someone else's ride. A final match should happen only after the people involved contact each other and agree. When signed-in users record contact or a help offer, the app also tries to send the post owner a lightweight email notification.

The app now has two operating modes.

When someone is signed out, it still behaves like a prototype: it shows realistic sample data and can keep local demo changes in the browser. That is useful for demos, design review, and quick testing.

When someone signs in, the app uses Supabase for shared data. Supabase handles email-code sign-in, the Postgres database, row-level security, notification records, and admin MFA requirements. That means the project has moved past "just a front-end mockup" while still keeping the sample-data mode that made early iteration fast.

The first goal was to model the workflow clearly. Once the workflow made sense, Supabase became the shared backend.

## The Big Idea: Geography Matters

The most important product decision in this app is that "nearby" is not enough.

Someone in Bethesda and someone in Hyattsville are both in Maryland. But they may be very different matches for a driver going to National Harbor. Likewise, someone leaving from Alexandria may be an excellent match for another person in Crystal City but a poor match for someone in Silver Spring.

For this first version, the app uses regional corridors:

- DC Northwest
- DC Northeast / Capitol Hill
- Arlington / Alexandria
- Fairfax / Falls Church
- Woodbridge / Springfield
- Silver Spring / Takoma Park
- Bethesda / Rockville
- Prince George's County

These corridors are rough buckets. They are not exact GPS routing. They are a useful first approximation.

You can think of each corridor as a lane feeding into National Harbor. If two people are in the same lane, the match is strong. If they are in neighboring lanes, the match may still be reasonable. If they are across the region from each other, a driver carpool may be impractical, though an Uber/Lyft split might still be possible with some flexibility.

That distinction is central:

- Driver carpools are stricter because one person is operating a vehicle and may not be able to go far off route.
- Uber/Lyft splits are more flexible because participants can choose a meeting point or accept a less direct pickup plan.

The app's matching logic reflects that.

## Where The App Lives

The React app lives in this subdirectory:

```text
ire_ride_connection_app/
```

The rest of the repository already had analysis-project files, including Python/R/project scaffolding and data folders. To avoid mixing concerns, the web app was created inside its own folder instead of putting front-end files at the repository root.

That keeps the project cleaner. The parent repository can still hold data work, notes, or analysis. The app folder can behave like a normal Vite/React project.

## Codebase Tour

Here is the important file structure:

```text
ire_ride_connection_app/
  README.md
  PLAIN_LANGUAGE_EXPLAINER.md
  SUPABASE_AUTH_CHECKLIST.md
  package.json
  package-lock.json
  index.html
  vite.config.js
  eslint.config.js
  .gitignore
  supabase/
    migrations/
  src/
    main.jsx
    App.jsx
    supabaseClient.js
    supabaseData.js
    styles.css
```

Each file has a distinct role.

## `package.json`: The App's Tool Belt

`package.json` tells Node and npm what this project is and what it needs.

The key scripts are:

```json
"dev": "vite --host 0.0.0.0",
"build": "vite build",
"lint": "eslint .",
"preview": "vite preview --host 0.0.0.0"
```

Plain-English translation:

- `npm run dev` starts the local development server.
- `npm run build` creates a production-ready version of the app.
- `npm run lint` checks the code for common mistakes.
- `npm run preview` serves the production build locally.

The main dependencies are:

- `react`: the UI library.
- `react-dom`: connects React to the browser page.
- `vite`: the development server and build tool.
- `@supabase/supabase-js`: browser client for Supabase Auth, database queries, and RPC calls.
- `@vitejs/plugin-react`: lets Vite understand React.
- `lucide-react`: icon library used for buttons, labels, and visual cues.
- `eslint`: code quality checker.

## Why Vite?

Vite is a modern build tool for front-end apps. It is fast, simple, and widely used with React.

Older React setups often made development feel like waiting for a microwave with no timer. You changed a file, then waited for the app to rebuild. Vite feels more like turning on a light switch. Change a file, see the update quickly.

For this project, Vite was a good fit because:

- The app is front-end focused.
- It needs quick iteration.
- It can start simple while still connecting cleanly to a backend.
- It keeps the starter project small and understandable.

## `index.html`: The Empty Stage

The `index.html` file is very small. It contains a single important element:

```html
<div id="root"></div>
```

That `root` div is where React puts the app.

Imagine a theater stage before the actors arrive. The HTML file builds the stage. React brings in the cast, props, and action.

## `src/main.jsx`: The Entry Point

`src/main.jsx` is the file that starts React.

It imports:

- React's `StrictMode`
- React DOM's `createRoot`
- The main `App` component
- The CSS file

Then it tells React:

```jsx
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

In plain language: "Find the root div in the HTML page and render the App inside it."

This file is intentionally boring. That is good. Entry points should be boring. They should start the app, not contain business logic.

## `src/App.jsx`: The Brain Of The App

Most of the project lives in `src/App.jsx`.

This file contains:

- The sample data.
- The route corridor model.
- The matching logic.
- The signed-out local storage fallback.
- The signed-in Supabase sync flow.
- The auth and admin MFA panels.
- The form behavior.
- The ride card behavior.
- The React components that render the interface.

For a larger production app, we would eventually split this into smaller files. For this prototype, keeping the model and interface together makes the project easier to understand.

That is a pragmatic engineering choice. Splitting code too early can make a small project harder to follow. Splitting code too late can make a large project hard to maintain. The trick is choosing the right level of structure for the current stage.

This project is still compact enough that one main app file is understandable, but the Supabase data access has already been split into helper files. That is a good sign of the architecture growing only where it has real pressure.

## The Data Model

The app has two main visible kinds of data:

- Participants
- Ride groups

The database also has relationship records that connect people to ride groups:

- Saved ride slots
- Pending contact or help-offer slots
- Confirmed matched slots

## Participants

A participant is a person.

Example fields:

```js
{
  id: "p1",
  name: "Maya Rodriguez",
  email: "maya@example.com",
  phone: "202-555-0116",
  neighborhood: "Columbia Heights",
  corridor: "dc-nw",
  intent: "offer",
  transportPreference: "carpool",
  seatsAvailable: 2,
  seatsNeeded: 0,
  maxPartySize: 3,
  availability: {
    thuAm: true,
    thuPm: true,
    friAm: true,
    sunPm: true
  },
  notes: "Can pick up near Columbia Heights..."
}
```

The important thing is that a participant is not automatically a ride group.

A person might:

- Offer carpool seats.
- Need a carpool seat.
- Want to split an Uber/Lyft.
- Be open to offering a carpool seat or splitting an Uber/Lyft.
- Be open to seeking a carpool seat or splitting an Uber/Lyft.

That distinction matters because the app needs to know when to create a group and when to simply add someone as a person looking for a ride.

## Ride Groups

A ride group is an actual opportunity that others can join or ask about.

Example:

```js
{
  id: "g1",
  hostId: "p1",
  type: "carpool",
  corridor: "dc-nw",
  routeFlexibility: "moderate",
  capacity: 2,
  riderIds: ["p2"],
  matchedSlotsByParticipant: {
    p2: ["thuAm"]
  },
  inquiries: ["p3"],
  inquirySlotsByParticipant: {
    p3: ["thuPm", "friAm"]
  },
  status: "committed",
  availability: {...}
}
```

A group has a host. The host is linked by `hostId`. A group can be a driver carpool, a carpool request, or an Uber/Lyft split.

That means the group does not copy Maya's full name, email, phone, and notes. It stores her ID. When the app needs Maya's details, it looks her up in the participants list. In the database, the final match state is still stored as `committed`; in the simple interface, users see that idea as `matched`, which is clearer for the current workflow.

The app also tracks which conference trip slots each contact or match applies to. That matters because a person might be interested in Thursday morning and Thursday evening, but not Friday morning. A later match for Thursday morning should not silently imply that Friday morning is also matched.

This is a classic data-modeling pattern. Instead of duplicating the same information in multiple places, keep one source of truth and connect records by ID.

## Why IDs Matter

Names are not reliable identifiers. Two people can have the same name. Someone can change how their name appears. Email addresses are better but should not always be used as internal IDs.

So the app-shaped data uses IDs like:

```text
p1
g1
```

In signed-out sample mode, new entries still use `Date.now()` to create simple browser-local IDs.

In signed-in mode, Supabase generates real database UUIDs. That is one of the differences between sample mode and the shared backend.

## Availability: Why It Uses Booleans

Availability is stored like this:

```js
{
  thuAm: true,
  thuPm: false,
  friAm: true,
  friPm: false
}
```

This is easier for the app than storing one comma-separated string like:

```text
Thu AM, Fri AM
```

A string is nice for humans but awkward for code. A boolean object is easy to filter, compare, and toggle.

The app can quickly ask: "Do this person and this ride group both have `friAm` set to true?"

That is how shared time slots are found.

The same slot IDs are now stored on contact and match records:

- `ride_inquiries.interest_slots` stores the pending slots someone contacted another user about.
- `ride_saves.saved_slots` stores the slots someone privately saved for later review.
- `ride_memberships.matched_slots` stores the slots that were actually confirmed as matched.

That lets the app show split states such as:

```text
Matched: Thu AM; pending: Thu PM
```

The database also prunes those slot arrays when a post's availability changes. If a host removes `Thu PM` from a post, old saved, pending, or matched `Thu PM` state is removed so the app cannot later match an inactive trip slot.

## Corridors: A Practical Substitute For Maps

The app does not use a maps API yet. Instead, it uses a list of corridors with labels, route notes, and adjacency rules.

Example:

```js
{
  id: "arlington-alexandria",
  label: "Arlington / Alexandria",
  short: "Arl/Alex",
  region: "VA",
  route: "GW Parkway / I-395 / Wilson Bridge"
}
```

The current app communicates route fit through match categories, route labels, and sorted cards.

This is a good example of a prototype doing enough without pretending to be final. The corridor model gives users a mental model of the region. It does not claim to calculate exact travel time.

## Corridor Adjacency

The app also defines which corridors are near each other:

```js
const corridorAdjacency = {
  "dc-nw": ["silver-spring-takoma", "bethesda-rockville", "dc-ne", "arlington-alexandria"],
  "dc-ne": ["silver-spring-takoma", "dc-nw", "pg-county"],
  "woodbridge-springfield": ["arlington-alexandria", "fairfax-falls-church"]
}
```

This is the app's current lightweight version of route intelligence.

If two people are in the same corridor, the match is strong. If they are in adjacent corridors, the match is still plausible. If they are far apart, the match gets weaker.

In a later version, this would probably become real geocoding and detour calculations.

## Matching Logic: How The App Ranks Rides

The matching logic lives in `scoreGroupForParticipant`.

It looks at one participant and one ride group, then produces a score.

The score is based on:

- Shared conference trip slots.
- Same corridor or nearby corridor.
- Whether the participant wants the type of ride being offered.
- Whether the group is open, pending, matched, or full.
- Whether the group has open spots.
- Whether the route flexibility is tight, moderate, or flexible.

This is not machine learning. It is a hand-built scoring system.

That is a good thing here.

For a small practical tool, a clear scoring system is often better than a mysterious algorithm. If a user asks why a ride is ranked highly, we can explain it:

"You share five time slots, you are in a nearby corridor, this is the ride type you want, and there is still space."

That is much better than saying, "The algorithm decided."

## The Matching Score In Plain English

The app starts with time overlap.

Each shared time slot adds points. If you both need Thursday morning, Friday morning, and Sunday morning, that matters.

Then it adds or subtracts points for geography:

- Same corridor: strong boost.
- Nearby corridor: smaller boost.
- Rideshare group across corridors: possible, small boost.
- Driver carpool with a likely detour: penalty.

Then it checks ride type:

- Looking for a carpool seat? Driver carpools get a boost.
- Looking to split Uber/Lyft? Rideshare pools get a boost.
- Wrong mode? The score drops.

Then it checks status:

- Open groups get a boost.
- Pending or matched groups can still appear.
- Full groups are penalized.

Finally, tight routes get extra penalties if the rider is not in the same corridor.

This reflects the real-world problem: asking a driver to go 20 minutes out of the way can sink the whole ride plan.

## Ride Status: Why It Is More Than Open Or Closed

The app uses these statuses:

- `open`
- `pending`
- `committed`
- `full`

This is more useful than a simple yes/no. One naming detail matters: the database value is still `committed` because that was the first implementation name, but the app presents that state to users as `matched`.

Real coordination has gray areas. Someone might have asked about a ride but not confirmed. A driver might have one rider matched for Thursday morning but still have that same seat open for Friday morning. A rideshare group might have three people on one trip slot but room for a fourth on another.

The app models those gray areas.

The function `effectiveStatus` also protects against bad status data. If a group has no open spots for any active slot, it is treated as full even if its stored status says something else. Manual `full` status also counts: when a host or admin marks a post full, the app treats it as closed until someone explicitly reopens it.

That is a small but important engineering habit: do not trust one field when another field can prove it wrong.

## Capacity: Driver Carpools And Rideshare Pools Count Differently

Capacity works differently for the two group types.

For a driver carpool, capacity means available carpool seats.

If Maya offers two carpool seats and Jon has matched with that ride for a selected slot, the app says something like:

```text
1/2 carpool seats committed by slot
```

For an Uber/Lyft split, the host is part of the ride pool. If Sam starts a rideshare pool with a party cap of four, Sam already counts as one rider.

So the app counts rideshare matched people for a slot roughly as:

```js
matched riders for that slot + 1 host
```

That `+ 1` is easy to miss, but it matters. It prevents the app from acting like the host is not in the vehicle.

The latest version counts capacity by trip slot. A group can be full on `Thu AM` and still have open space on `Fri AM`. A manually full post is different: it is closed for all slots until reopened.

## Storage: Sample Notebook Plus Shared Database

The app still uses browser local storage when no Supabase session is active.

That means a signed-out demo can add someone, record contact or help offered, or mark a match, and those demo changes stay in that browser after a page refresh.

Local storage is like a notebook taped to your own laptop. It is useful while you are working, but nobody else can see it.

That is why it is now treated as sample/prototype behavior, not the real shared system.

When a user signs in, the app switches to Supabase.

Supabase provides:

- Email one-time code authentication.
- A shared Postgres database.
- Row-level security policies.
- Remote participant and ride group storage.
- Admin role checks.
- MFA step-up for admin-only privileges.

That gives the app a useful split personality: local sample data for quick demos, shared Supabase data for real users.

The current interface labels signed-out data as sample data and includes a `Stay in sample mode` escape hatch if someone opens sign-in and then decides not to continue.

## State Flow: How A Form Becomes A Ride Card

Here is the journey when someone fills out the form.

1. The form fields live in React state as `form`.
2. The user types into inputs.
3. Each input calls `updateFormField` or `updateAvailability`.
4. When the user submits, `handleSubmit` creates a new participant.
5. If the participant is offering carpool seats, the app creates a new carpool group.
6. If the participant is looking for a carpool seat, the app creates a carpool request group.
7. If the participant wants to split Uber/Lyft, the app creates a rideshare group.
8. The participant and any new groups are saved into app state.
9. If the user is signed out, the same data is written into local storage.
10. If the user is signed in, the participant is upserted to Supabase.
11. If the participant is hosting any carpool offer, carpool request, or rideshare group, the hosted group is upserted too.
12. If the signed-in user removes their post, the app deletes their hosted ride groups but keeps their participant row so name, contact details, and ride-profile fields can prefill a future post.
13. React reloads the board and re-renders the interface.

That is the central React loop:

```text
user action -> local state or Supabase update -> board reloads -> interface redraws
```

Once you understand that loop, React becomes much less mysterious.

## Supabase: The Shared Filing Cabinet With Locks

Supabase is now the app's shared backend.

In plain language, Supabase gives us:

- A database where everyone sees the same current board.
- A sign-in system so the app knows who is editing.
- Security rules so one user cannot freely read or change another user's private profile.
- Admin tools that can be unlocked only for trusted accounts.

The main database tables are:

- `profiles`: basic auth-linked user profile information.
- `participants`: the full ride profile for a signed-in user, including contact info.
- `participant_directory`: the authenticated board directory table that exposes the fields needed for matching and contact reveal.
- `ride_groups`: carpool and Uber/Lyft split groups.
- `ride_memberships`: final matched riders, including which trip slots are matched.
- `ride_inquiries`: the internal contact/help markers for people who have reached out but are not matched yet, including which trip slots are pending.
- `ride_saves`: private saved-post records, including which trip slots were saved.
- `ride_notification_events`: one record per requester/post notification attempt.
- `admin_activity_log`: recent admin moderation activity.
- `admin_users`: the list of auth users who are allowed to become admins.

The `participant_directory` table is worth calling out. Earlier, this was modeled as a view. The safer version is a real table with row-level security. A trigger keeps it synchronized with `participants`. In the current attendee-board version, visible directory rows include contact fields because the app is designed for signed-in attendees to reveal email or phone and coordinate directly outside the app. The reveal buttons are a user-experience step, not a cryptographic privacy boundary. Notes are also visible to signed-in users, so the UI tells users that notes should not contain private information.

Think of it like a conference badge. The badge can show your name and neighborhood for coordination. It does not need to print your whole registration record.

## Row-Level Security: Locks On Every Drawer

Supabase row-level security, often shortened to RLS, is how the database decides who can see or change each row.

The React UI hides controls that a regular user should not use. But hiding a button is not security. A determined person can still call APIs directly.

So the real enforcement lives in the database.

Regular users can manage their own participant record. Authenticated users can see visible board directory rows and ride groups. Admins can do more, but only after passing MFA.

That last point matters: the app separates "this account is listed as an admin" from "this session currently has admin power."

## Admin MFA: Showing The Door Before Opening It

Admin accounts are listed in `public.admin_users`.

The app uses `get_my_role()` so a signed-in admin can be recognized and shown the MFA panel. But admin-only RLS policies use private helper functions that require both:

- The user is listed as an admin.
- The current session has Supabase authenticator assurance level `aal2`.

That means a returning admin can see the prompt to enter an authenticator code, but the database will not treat them as fully privileged until MFA succeeds.

This fixes a subtle trap. If the app waited for full MFA-verified admin access before showing the MFA panel, returning admins could get stuck outside the very control they needed to unlock admin access.

Good security often works this way: show the right locked door, but do not hand over the keys until the second check passes.

## App-Facing RPCs

The app uses a few Supabase RPC functions:

- `get_my_role`
- `save_ride_for_later`
- `request_join_ride`
- `commit_to_ride`
- `admin_update_group_status`
- `admin_remove_participant_post`

Supabase's advisor warns that signed-in users can execute these security-definer functions. That warning is useful, but in this app those RPCs are intentional. They are the narrow, audited doors through which signed-in users can privately save posts, record contact/help, or record an agreed match. The admin RPCs use the same pattern, but require MFA-verified admin access before they change status or remove a post.

The ride-action RPCs check the submitted participant, ride group, and selected slot IDs before changing data. Fit is intentionally not a hard database requirement anymore: users may save or contact non-fit posts when there are open slots. The RPCs still reject own-post actions, already-matched slots, inactive selected slots, manual full status, full slots, missing pending contact before a match, and users who do not own the submitted participant unless the session has MFA-verified admin access.

The `commit_to_ride` name is now a little historical. In the simple interface, the user-facing action is "mark matched." The RPC keeps the older name, but it now requires a prior contact marker and checks who is allowed to mark the match:

- For driver carpools, the driver finalizes the match.
- For carpool requests, a helper must mark that they offered help first.
- For Uber/Lyft splits, either the organizer or the contacted participant can mark the match after the contact marker exists.

The selected slots are important. `save_ride_for_later` records private saved slots, `request_join_ride` records pending interest for the chosen slots, and `commit_to_ride` records only the selected agreed slots and leaves any other pending slots pending.

After `request_join_ride` succeeds in signed-in mode, the frontend calls the `send-ride-notification` Edge Function. That function verifies the requester, confirms the inquiry exists, writes or reuses a notification-event row, and sends a minimal Resend email asking the post owner to sign in and review the possible match. The alert is helpful, but it does not replace direct coordination by email or phone.

The current migration also keeps old slot state from becoming dangerous. If availability changes after someone saved, contacted, or matched a slot, the database trims `saved_slots`, `interest_slots`, and `matched_slots` down to the post's still-active slots.

Admin remove-post behavior is deliberately narrower than account deletion. The admin helper removes hosted ride groups from the board but preserves the participant row/profile details. That lets the attendee return later with their contact information still available for prefill.

The important engineering rule is not "never use security-definer functions." The rule is "make them small, explicit, and carefully permission-checked."

## React Components: The App As Reusable Pieces

The app is made from components. A component is a chunk of interface plus the logic needed to render it.

The main components are:

- `App`
- `AuthPanel`
- `AdminMfaPanel`
- `AdminToolsPanel`
- `InstructionsModal`
- `SlotActionModal`
- `BoardControls`
- `EntryForm`
- `PlanSummary`
- `RideActivityPanel`
- `PrototypePreviewTools`
- `RideCard`
- `FitLegend`
- `ScorePill`
- `StatusBadge`
- `Stat`

Think of components like sections of a newsroom budget meeting board. One area collects pitches. One area shows the lineup. One area shows status. Each section has its job, but they all reflect the same underlying story list.

`App` owns the main data and passes the right pieces down to child components.

For example, `RideCard` receives:

- The group to display.
- The participant list so it can look up names.
- The selected participant so it can calculate actions.
- The match category and route fit details.
- Functions for saving slots, direct-contact markers, match recording, admin removal, and status changes.

This is called passing props.

Props are how parent components give child components the information and tools they need.

## `useState`: Memory For The Interface

React's `useState` stores values that can change while the app is running.

This app uses state for:

- The full participant/group dataset.
- The form fields.
- The selected participant used for match scoring.
- The corridor filter.
- The status filter.
- The search query.
- Notification/action feedback.

When any of those change, React updates the screen.

## `useMemo`: Avoiding Repeated Work

The app uses `useMemo` for derived values:

- Filtered and sorted ride groups.
- Best matches for the selected participant.
- Saved, incoming, outgoing, and matched activity lists.
- Summary stats.

Derived values are values you can calculate from existing state.

Example: "How many open spots are there?" is not stored separately. It is calculated from the current groups.

That avoids stale data. If you store both the raw data and the summary number, they can drift apart. If you calculate the summary from the raw data, the summary stays honest.

## Search And Filters

The board can be filtered by:

- Search text.
- Corridor.
- Status.

The filtering happens before sorting.

That means the app first asks, "Which rides should be visible?" Then it asks, "Of the visible rides, which are the best matches?"

That order matters. If you sort first and filter later, you may do unnecessary work. More importantly, the mental model is cleaner: narrow the room, then rank the options inside it.

## The Visual Design

The design is meant to feel like a practical coordination board, not a marketing page.

There is no giant hero section. There is no decorative pitch copy. The first screen is the actual tool.

The first version put too much information on one screen. It worked, but it felt busy. That was useful feedback: the app was doing the right things, but it was asking users to absorb too much at once.

The current app deliberately steps back from that and uses a small set of focused areas:

- `Your plan`: enter or update the one ride profile tied to the user.
- `Likely matches`: browse the best open carpool offers, carpool requests, and Uber/Lyft split groups.
- `Your ride activity`: track saved rides, incoming contact/help offers, people you contacted, and confirmed matches. This appears for signed-in users after they have a profile.

That structure lowers the mental load. It gives the user one place to edit their own plan, one place to browse the board, and one place to return to work already in progress.

Inside the main view, the layout has four conceptual zones:

- Form area: the user's current ride plan.
- Activity area: saved posts, pending contact, and matched rides.
- Match area: likely rides and requests.
- Compact controls: search, corridor, status filtering, and route-fit context.

This matches the user's workflow:

1. Sign in or use sample mode.
2. Add or review ride information.
3. Save posts that may be worth revisiting.
4. Browse available ride groups.
5. Evaluate matches from the correct person's point of view.
6. Contact the other person directly by email or phone, mark that contact happened for selected slots, then mark selected slots as matched after agreement.
7. Keep the post current by editing it or removing it from the board when it is no longer needed.

The app uses cards for individual rides, which makes sense because each ride is a repeated item with its own status, people, capacity, and actions.

The current app keeps each ride card summary-first. The card shows the ride type, route area, trip slots, capacity, contact buttons, and next action immediately. Saving, recording interest, and marking matches open a slot chooser so the action applies only to the right conference trips. Longer notes and contact/match history live behind `Details and history`, which keeps the board from feeling like every card is shouting at once.

The app avoids nested cards and keeps the main board organized with clear panels.

## `styles.css`: The Wardrobe And Stage Lighting

The CSS file controls layout, color, spacing, responsive behavior, and visual states.

Some important choices:

- CSS variables define colors and reusable values.
- The hero stats use passive metric styling so they do not look like buttons.
- The workspace uses CSS grid for a responsive two-column desktop layout.
- Media queries collapse the layout on smaller screens.
- Buttons, inputs, and cards have stable sizes so the layout does not jump around.
- Status colors help users quickly read whether a ride is open, pending, matched, or full.
- A compact help button opens the instructions modal without adding permanent instructional copy to the board.

The corridor model is still in the matching logic, but the user sees it through match categories, route labels, and match ordering.

## Icons

The app uses `lucide-react` for icons.

Icons are used for:

- Carpool rides.
- Rideshare groups.
- Calendar/time slots.
- Location.
- Search.
- Filters.
- Contact actions.
- Status actions.
- Saved-post actions.

The goal is not decoration. Icons help users scan the interface faster.

A car icon next to "Driver carpool" and a people icon next to "Uber/Lyft split" makes the difference between ride types easier to catch at a glance.

## Why We Built The Front End First

It would be tempting to jump straight to a database, login system, automated email notifications, and admin tools.

At the very beginning, that would have been premature.

The hard part of this project is not creating a table in a database. The hard part is understanding the coordination workflow:

- How should rides be grouped?
- What does "full" mean?
- How do contact markers differ from final matches?
- How should route fit be communicated?
- How do carpool seats differ from Uber/Lyft split capacity?

Building the front-end prototype first let us answer those questions quickly.

Good engineering often means delaying expensive decisions until the shape of the problem is clearer.

Then, once the workflow had a shape, we added Supabase.

That sequence matters. The backend now supports a model we understand instead of forcing the product to fit a schema we guessed too early.

That does not mean avoiding architecture. It means choosing architecture that matches the stage of the project.

## Technical Decisions And Why They Were Made

## Decision: Put The App In A Subdirectory

The parent repository already existed. Instead of turning the entire repo into a Vite app, the React project was created inside:

```text
ire_ride_connection_app/
```

Why this was good:

- It avoided disturbing existing project files.
- It made the app easy to run independently.
- It kept front-end dependencies inside one folder.
- It respected the existing repo structure.

Lesson: when adding a new system to an existing project, avoid taking over the whole house if you only need one room.

## Decision: Use Sample Data

The app includes realistic sample participants and ride groups.

Why this was good:

- The UI can be tested immediately.
- The matching logic has real-looking cases to rank.
- The visual states are visible: open, pending, matched, full.
- It makes the app easier to understand without needing a backend.

Lesson: good sample data is not filler. It is a development tool.

## Decision: Use Corridors Instead Of Addresses

The app asks for a neighborhood and a regional corridor, not a precise address.

Why this was good:

- It avoids collecting more sensitive location data than needed.
- It makes form entry faster.
- It supports approximate matching.
- It reflects how people usually talk about regional commute patterns.

Later, the app can add optional geocoding or pickup points.

Lesson: collect the least precise data that still solves the immediate problem.

## Decision: Keep Matching Explainable

The app keeps a match score internally for sorting, but shows users plain match categories instead of precise-looking numbers:

- Strong match
- Good match
- Possible match
- Weak match

It also shows route explanation labels like:

- Same corridor
- Nearby route
- Flexible stretch
- Likely detour

Why this was good:

- Users can understand why a ride appears high or low.
- Organizers can tune the scoring later.
- The system is easier to debug.

Lesson: if users will act on a recommendation, they need to understand it well enough to trust it.

## Decision: Keep Local Sample Mode While Adding Supabase

Local storage gave us early persistence without a backend. Supabase later gave us shared persistence with authentication and database security.

Why this was good:

- The first prototype was fast.
- The app could be tested before auth existed.
- Sample mode still works when Supabase env vars are missing.
- Signed-in mode now has real shared data.

The tradeoff:

- Local sample data is still only saved in one browser.
- Real shared data requires Supabase configuration.
- Developers must be careful not to confuse sample mode with production behavior.

Lesson: local storage is a useful sketchpad. Supabase is the shared filing cabinet.

## Decision: Use Email Codes For Sign-In

The app uses Supabase email sign-in.

We originally planned around one-time numeric codes. The first live test sent a sign-in link instead because the hosted Supabase template was still link-based.

After the Supabase account was upgraded, we updated the hosted template through the Management API so the email body uses `{{ .Token }}`. The app now expects the user to copy the code from email into the `One-time code` field.

Why this was good:

- It gives users a clear code-entry flow.
- It keeps sign-in passwordless.
- It avoids requiring users to leave the browser flow through a magic link.

Lesson: good engineering means testing the provider behavior end to end, then making the UI and configuration match.

## Decision: Require MFA For Admin Privileges

The app has admin troubleshooting features, such as previewing matches from another participant's point of view.

Those tools are useful for support, but they should not be available to every signed-in user.

The database now requires admin membership plus MFA verification before granting admin-level RLS access. The UI mirrors that by showing an admin MFA panel to admin accounts and only showing the signed-in participant switcher after MFA is verified.

Lesson: admin tools are powerful because they cross normal user boundaries. Treat them like a locked maintenance room, not like a hidden menu item.

## Decision: Track Contact And Matches Per Slot

One ride profile can include several separate conference commute slots. Treating the whole post as one match was too coarse because a Thursday morning agreement does not automatically cover Thursday evening, Friday morning, or Sunday morning.

The app now records contact interest and confirmed matches by slot.

Why this was good:

- Users can express interest in only the trip portions they actually want.
- Drivers and organizers can confirm only the slots everyone has agreed to.
- Remaining pending slots stay visible instead of disappearing.
- Capacity can be evaluated by slot, which better reflects real carpool seats and rideshare space.

Lesson: simple interfaces can still need precise state. The UI stays calm, but the database records the specific real-world commitment.

## Bugs And Issues We Ran Into

The project had several useful bumps. These are worth documenting because they are exactly the kind of things real projects run into.

## Issue 1: npm Was Pointing At A Private Registry

When we first tried to scaffold the Vite app with:

```bash
npm create vite@latest ire_ride_connection_app -- --template react
```

npm failed with an authentication error.

The problem was not Vite. The machine's npm configuration pointed to a private registry with stale credentials.

The fix was to install dependencies with a one-command public registry override:

```bash
npm_config_registry=https://registry.npmjs.org/ npm install
```

This avoided editing the user's global npm configuration.

Lesson: when a tool fails, separate project problems from environment problems. The codebase was not broken. The package manager was reading a machine-level config.

Best practice: do not casually edit global config to make one project work. Prefer command-specific overrides when possible.

## Issue 2: The Browser Verification Tool Was Not Available

The intended browser plugin was present in the environment description, but its JavaScript control tool was not exposed in the session.

Instead of leaving the UI unchecked, we used local Playwright automation from the app directory.

The smoke test:

- Opened the app.
- Confirmed the main heading rendered.
- Added a sample participant.
- Confirmed a new ride card appeared.
- Clicked contact and match actions.
- Captured desktop and mobile screenshots.

Lesson: verification matters more than a specific tool. If one verification path is blocked, find another reliable path.

## Issue 3: The Board Heading Got Squeezed

The first desktop screenshot showed the main heading breaking into one-word lines:

```text
Open
rides
and
shared
ride
pools
```

The cause was the header layout. The title and filter controls were fighting for horizontal space.

The fix was to stack the board heading above the controls instead of forcing them into the same row.

Lesson: responsive design bugs are often layout negotiation bugs. The content is fine. The containers are arguing.

Best practice: always inspect screenshots at real viewport sizes. A layout can pass a build and still look bad.

## Issue 4: Action Labels Needed To Match The Real Workflow

Some early action buttons were too long and also implied the app was doing more than it really was.

The final labels are:

```text
Record contact
Record help offer
Mark matched
```

That wording is more honest. The app sends a lightweight notification to the post owner when contact/help is recorded, but it is not managing the conversation or confirming the ride. People still reveal contact details, coordinate outside the app, and then record what happened.

The meaning stayed clear, and the layout became cleaner.

Lesson: interface copy is part of engineering. A technically correct label that does not fit is still a bug.

## Issue 5: "Car Seat" Was Ambiguous

The first version used language like:

```text
Looking for a car seat
Offering car seats
```

That could be misunderstood as a child safety seat. The wording also did not clearly distinguish driver carpools from Uber/Lyft split rides.

The fix was to use:

```text
Looking for a carpool seat
Offering carpool seats
```

Lesson: plain language is not just shorter language. It is language that prevents wrong interpretations.

## Issue 6: Generated Files Needed To Be Ignored

Running builds and smoke tests created files like:

- `dist/`
- `node_modules/`
- `test-results/`

Those should not be committed as source code.

The fix was adding `.gitignore` entries:

```text
node_modules
dist
test-results
.DS_Store
```

Lesson: every project should draw a line between source files and generated files. Otherwise the repository becomes noisy quickly.

## Issue 7: Supabase Initially Sent A Link Instead Of A Numeric Code

The app called Supabase's `signInWithOtp()`, and the UI originally told users to expect a one-time code.

During real testing, Supabase sent a magic sign-in link.

That was confusing but not mysterious. Supabase can support token-based emails, but the hosted email template was still using the confirmation URL placeholder. When we first tried to patch the email template through the Management API, Supabase rejected the change because the project was still on a plan that did not allow hosted template edits with the default email provider.

The temporary fix was to change the app copy to match magic links. After the Supabase account was upgraded, we retried the Management API patch and it succeeded.

The final template now uses:

```text
{{ .Token }}
```

and no longer depends on:

```text
{{ .ConfirmationURL }}
```

The app copy was then changed back to code-first language:

- Primary action: "Send code."
- Message: "Check your email for a one-time sign-in code."
- Code field: "One-time code."

Lesson: always test auth emails end to end. Authentication is where product copy, provider settings, pricing limits, and user expectations collide.

## Issue 8: Admin MFA Had A Chicken-And-Egg Problem

Admin privileges require MFA. But the app also needs to show admins the MFA challenge panel.

At one point, `get_my_role()` treated someone as an admin only after MFA was already verified. That created a trap: returning admins could need MFA to become admin, but need admin status to see the MFA panel.

The fix was to separate two questions:

- Is this account listed as an admin?
- Does this session currently have MFA-verified admin access?

`get_my_role()` answers the first question. Private RLS helper functions answer the second question.

Lesson: authentication systems often need a "recognized but not elevated yet" state. Model that state directly.

## Issue 9: Supabase Security Advisor Warnings Needed Judgment

Supabase warned that signed-in users can execute several security-definer functions.

That warning is useful. It made us inspect the functions carefully.

But the answer was not to blindly revoke everything. The app needs narrow RPCs for:

- Getting the current user's role.
- Saving a post privately for selected slots.
- Requesting to join a ride.
- Marking an agreed match.
- Admin status changes and post removal, after MFA verification.

The fix was to move general helper functions out of the exposed public surface, revoke unneeded execution grants, and leave only the intentional app RPCs callable by authenticated users.

Lesson: security tools point to places that deserve attention. They do not replace engineering judgment.

## Issue 10: Profile Updates Could Create Duplicate Ride Groups

The participant save path upserted the participant but inserted ride groups every time.

That meant a user could update their profile and accidentally create another hosted carpool or rideshare group.

The fix had two parts:

- Database constraint: one host can have at most one carpool offer group, one carpool request group, and one rideshare group.
- Client behavior: save uses an upsert for hosted groups instead of a blind insert.

Lesson: prevent duplicates at the database layer, not only in the UI. The UI is a helpful front door, but the database is the foundation.

## Issue 11: "Open To Either" Needed More Precision

At one point, the form had one broad option:

```text
I am open to either carpool or Uber/Lyft
```

That sounded simple, but it hid an important difference. Someone may be open to driving and offering carpool seats, or they may be open to seeking a seat. Those are opposite roles.

The fix was to split the option into two clearer plans:

```text
I am open to either offering carpool seat or splitting Uber/Lyft
I am open to either seeking carpool seat or splitting Uber/Lyft
```

Lesson: fewer choices are not always simpler. A vague choice can push complexity into the user's head. Better choices make the real-world role obvious.

## Issue 12: Matching Should Require A Conversation First

Stakeholders pointed out that attendees should talk by email or phone before anyone records a final match.

That changed the workflow. The app now treats direct contact as the first step and match as the recorded outcome after mutual agreement.

The fix included frontend and database logic:

- Reveal email or phone first, then email or call outside the app.
- Mark that contact or a help offer happened for selected trip slots.
- Disable match actions until the relevant contact marker exists.
- Let carpool drivers finalize their own carpool matches for selected agreed slots.
- Let Uber/Lyft organizers or contacted participants mark a match after contact.
- Keep `Matched` out of the ordinary status dropdown for unmatched posts, so people do not skip the contact-first path.
- Keep sign-in, profile editing, prototype preview tools, card history, and owner-only status controls out of the way until they are needed.

Lesson: the right button is not always the fastest button. Sometimes good product design slows one action down so the real-world agreement is cleaner.

## Issue 13: Whole-Post Matches Were Too Broad

After the contact-first flow worked, another real-world issue appeared: one post can cover several trips. Matching someone for Thursday morning should not imply that Friday morning or Sunday morning is also agreed.

The fix was to make contact interest and final matching slot-specific:

- `ride_inquiries.interest_slots` stores which slots the contact/help marker applies to.
- `ride_memberships.matched_slots` stores which slots were actually confirmed.
- `ride_saves.saved_slots` stores which slots someone privately saved.
- Recording contact opens a slot picker.
- Marking a match opens a slot picker and only moves selected pending slots into matched state.
- Unselected pending slots stay pending.
- Unmentioned shared slots stay untouched.

Lesson: when one record represents several real-world events, the app must store which event the action applies to.

## Issue 14: Availability Changes Can Make Old Slots Stale

After slot-specific saves, contact markers, and matches existed, another edge case appeared. A host could remove a trip slot from their post after someone had saved, contacted, or matched that slot.

The fix was to make availability edits clean up dependent slot state:

- Removed trip slots are pruned from `ride_saves.saved_slots`.
- Removed trip slots are pruned from `ride_inquiries.interest_slots`.
- Removed trip slots are pruned from `ride_memberships.matched_slots`.
- A match cannot be recorded for a pending slot that is no longer active on the post.
- A manually full post stays closed until reopened, even if computed capacity would otherwise show room.
- Admin remove-post now removes hosted ride groups while preserving the participant profile row.

Lesson: once users can edit the source schedule, every stored decision tied to that schedule needs a cleanup path.

## What Good Engineers Did Here

This project shows several habits that matter in real software work.

## They Read The Existing Project First

Before adding a React app, we checked the repo structure. It was not already a Vite app. It was an analysis-style project with data folders and config files.

That led to the subdirectory decision.

Good engineers do not charge in with assumptions. They look at the terrain first.

## They Kept Existing Work Untouched

There was an existing untracked `config/` folder in the parent repo. We did not modify or remove it.

That matters. In a shared workspace, unrecognized changes may belong to someone else.

Good engineers avoid cleaning up things they do not own.

## They Built The Simplest Thing First, Then Added The Backend

The first version focused on modeling:

- People.
- Groups.
- Capacity.
- Status.
- Route fit.
- Availability.
- Inquiries.
- Commitments.

That is the valuable core.

Then Supabase was added once the model had proven useful.

Good engineers do not confuse "more infrastructure" with "more progress." They also do not avoid infrastructure forever. They add it when the product has earned it.

## They Verified Behavior, Not Just Syntax

The code was checked with:

```bash
npm run lint
npm run build
```

But that only proves the code compiles and passes static checks.

We also used browser automation to verify that the app actually loaded, rendered, accepted a new listing, and updated the board.

Good engineers test the thing the user experiences.

## They Used Screenshots To Catch Design Bugs

The squeezed heading and cramped button labels were not build errors. They were visual defects.

Screenshots caught them.

Good front-end work needs visual inspection. Automated checks are useful, but they do not replace looking at the product.

## Potential Pitfalls And How To Avoid Them

## Pitfall: Treating Corridors As Exact Routes

The current corridor model is approximate.

Do not treat "Nearby route" as a promise that the ride is convenient. It is a clue, not proof.

How to avoid trouble:

- Label route fit clearly.
- Let users read notes.
- Add maps/geocoding later if the app becomes operational.
- Ask drivers to specify pickup constraints.

## Pitfall: Sample Mode Can Be Mistaken For Real Shared Data

Local storage can trick you. In signed-out sample mode, it makes the app feel persistent, but only on one browser.

How to avoid trouble:

- Treat signed-out data as demo data.
- Use signed-in Supabase mode for real shared coordination.
- Make the UI clear when the app is in sample mode.
- Keep the `Stay in sample mode` option available when someone starts sign-in but changes their mind.

## Pitfall: Contact Info Is Sensitive

The app lets attendees reveal email or phone details on a card so they can coordinate before marking a match.

That may be right for a controlled attendee group. It may not be right for a fully public app.

How to avoid trouble:

- Keep contact details hidden in the card UI until the user chooses to reveal them.
- Let people copy or use the revealed details outside the app.
- Be clear that the reveal button is not a database privacy boundary in the current signed-in attendee board.
- Let users choose whether to add a phone number; email is required for account and coordination.
- Add organizer moderation.
- Consider using built-in contact request messages instead of direct contact display.

## Pitfall: Status Can Drift From Reality

Someone might mark a ride matched, then change plans. A driver might forget to update capacity.

How to avoid trouble:

- Add update reminders.
- Add expiration dates.
- Let hosts confirm or reject contact requests.
- Keep a visible "last updated" timestamp.

## Pitfall: Matching Scores Can Look More Precise Than They Are

An exact-looking score can feel more authoritative than it really is. But the current matching is based on rough rules, not live travel-time routing.

How to avoid trouble:

- Show match categories such as "Strong match" or "Possible match" instead of exact numbers.
- Pair those categories with route labels like "Nearby route."
- Avoid implying the app knows exact travel time.
- In future versions, show actual estimated detour if using a maps API.

## Pitfall: Overbuilding Too Early

At the beginning, it would have been easy to spend days on authentication, database schema, admin permissions, and notifications before knowing whether the ride model worked.

How to avoid trouble:

- Prototype first.
- Validate the workflow.
- Add infrastructure when the workflow proves useful.

## What To Learn From The Technologies

## React

React helps build interfaces from reusable components.

The core mental model:

```text
state changes -> React re-renders the UI
```

If you understand that, the rest becomes easier.

React is especially good when the interface has many parts that all depend on the same data. This app is a good example:

- The stats in the header depend on the groups and participants.
- The ride cards depend on the groups and participants.
- The best-fit list depends on the selected participant.
- The match categories and route labels depend on the groups and participant corridors.

One data change can update several parts of the screen.

## Vite

Vite is the development and build tool.

It gives the project:

- A local dev server.
- Fast hot updates.
- Production builds.
- A simple configuration file.

For small to medium React apps, Vite is usually a strong default.

## Supabase

Supabase is the backend platform.

In this app it handles:

- Email one-time code sign-in.
- Postgres database storage.
- Row-level security.
- Database migrations.
- RPC functions for ride actions.
- Edge Functions for notification email.
- MFA-aware admin access.

Supabase is helpful here because the app needs a real shared board, not just a single-user browser notebook.

The important lesson is that Supabase is not just "where the data lives." It is also where security rules live. The database is responsible for enforcing who can see and change what.

## ESLint

ESLint checks for code problems.

It is like an editor who catches messy sentences before publication. It does not tell you whether the story is good, but it catches many avoidable mistakes.

In this project, `npm run lint` passed after the edits.

## Playwright

Playwright is a browser automation tool.

We used it to load the app, interact with it, and take screenshots. That gave us confidence that the app worked as a real page, not just as compiled JavaScript.

For front-end projects, Playwright is valuable because many bugs only appear in the browser.

## CSS Grid

CSS Grid is used for the app layout.

It is well suited to this app because several screens have clear regions:

- Main board.
- Side panel.
- Filter controls.
- Summary/status areas.

Grid lets those regions resize and collapse cleanly.

## Lucide Icons

Lucide provides simple React icons.

The project uses icons to make the interface easier to scan. Icons are not the app's core feature, but they improve usability when used with restraint.

## How The Pieces Connect

Here is the whole app flow in one diagram:

```text
index.html
  contains <div id="root">

src/main.jsx
  finds #root
  renders <App />

src/App.jsx
  defines sample data and UI state
  stores app state
  calculates matches
  renders components

src/supabaseClient.js
  creates the Supabase browser client

src/supabaseData.js
  translates between React-shaped data and database rows
  fetches the board
  saves participants and ride groups
  calls ride action RPCs and notification functions

supabase/migrations/
  defines tables, policies, functions, and constraints

src/styles.css
  controls layout, colors, spacing, responsive behavior

browser localStorage
  keeps signed-out sample data after refresh

Supabase
  stores shared signed-in app data
  enforces RLS and admin MFA rules
  records notification and admin activity
```

And here is the user workflow:

```text
attendee fills form
  -> React updates form state
  -> user submits
  -> app creates participant
  -> app may create carpool offer, carpool request, or rideshare group
  -> signed-out mode saves to localStorage
  -> signed-in mode saves to Supabase
  -> ride board re-renders
  -> match rankings and categories update
  -> stats update
```

And here is the contact-first match flow:

```text
attendee clicks Reveal email or Reveal phone
  -> people talk directly outside the app
  -> attendee chooses the slots they contacted about
  -> app records pending interest for those slots
  -> post owner may receive a lightweight email alert
  -> allowed user chooses the slots everyone agreed to
  -> app records only those selected slots as matched
  -> any other pending slots stay pending
```

## What Would Come Next

This app is now a working React/Supabase foundation, but it is not the final production system.

Good next steps:

1. Add timestamps and update reminders.
2. Expand organizer exports if the current admin CSV is not enough.
3. Add optional pickup coordinates or meeting points.
4. Add real route/detour estimates.
5. Add privacy controls for contact information.
6. Add more dedicated admin moderation screens if the board oversight tools need to grow.
7. Add import from the original Google Sheet.
8. Keep the hosted email template under source-control notes/checklists so future changes do not accidentally remove `{{ .Token }}`.
9. Keep production and local auth redirect URLs in sync as deployment URLs change.

## Backend Options We Considered

Several backend paths could have worked. Supabase is the one currently implemented, but the comparison is still useful because it explains why.

## Google Sheets API

Best if organizers want to keep a sheet as the source of truth.

Pros:

- Familiar.
- Easy manual review.
- Good bridge from the original workflow.

Cons:

- Permissions can be awkward.
- Concurrent edits can be messy.
- Not ideal for complex status workflows.

## Airtable

Best if the team wants a friendly database-like interface without building a full admin panel.

Pros:

- Good for structured records.
- Easy for non-developers to inspect and edit.
- Better relationships than a basic spreadsheet.

Cons:

- Another paid/service dependency.
- API limits and permissions need care.

## Supabase

Best if the app is becoming a real shared product. This is the current choice.

Pros:

- Real database.
- Authentication support.
- Row-level security.
- Good developer experience.

Cons:

- More setup.
- Requires careful schema and permissions.

## Custom API

Best if this needs highly custom behavior.

Pros:

- Full control.
- Can model workflows exactly.

Cons:

- More code to write.
- More code to maintain.
- More deployment complexity.

For this project, Supabase won because it gives the app a real database, auth, and row-level security in one system.

## Current Supabase Tables

The app now has real Supabase tables. The important ones are:

```text
profiles
  id
  email
  display_name
  created_at
  updated_at

admin_users
  user_id
  created_at

participants
  id
  user_id
  name
  email
  phone
  neighborhood
  corridor
  intent
  transport_preference
  seats_available
  seats_needed
  max_party_size
  availability
  notes
  created_at
  updated_at

participant_directory
  board-visible participant fields for matching, contact reveal, and display
  contact details and notes visible on eligible signed-in board rows

ride_groups
  id
  host_participant_id
  type
  corridor
  route_flexibility
  capacity
  status
  availability
  created_at
  updated_at

ride_memberships
  group_id
  participant_id
  matched_slots
  created_at

ride_inquiries
  group_id
  participant_id
  interest_slots
  created_at

ride_saves
  group_id
  participant_id
  saved_slots
  created_at
  updated_at

ride_notification_events
  id
  event_type
  group_id
  requester_participant_id
  recipient_participant_id
  requester_user_id
  recipient_user_id
  recipient_email
  status
  email_provider
  provider_message_id
  error_message
  details
  created_at
  sent_at
  updated_at

admin_activity_log
  id
  actor_user_id
  action
  target_user_id
  target_participant_id
  target_group_id
  details
  created_at
```

Availability is stored as JSON on participants and ride groups. That keeps the first version simple while still being structured enough for matching.

The database also includes triggers and helper functions:

- To keep `participant_directory` synced.
- To calculate open spots.
- To record contact/help and mark agreed matches through controlled RPCs.
- To save posts privately for selected slots.
- To record notification attempts.
- To validate ride-action compatibility before recording contact/help or matches.
- To enforce admin access only after MFA.

## The Most Important Product Lesson

The interesting part of this project is not that it uses React.

The interesting part is that a simple spreadsheet problem turned into a coordination problem.

That happens all the time in software. A user asks for "a form" or "a table," but the deeper need is a workflow:

- Who needs what?
- Who can provide it?
- What constraints matter?
- What is the current status?
- What should happen next?

Good software engineering starts by finding that workflow.

The code is just how we make the workflow real.

## The Most Important Engineering Lesson

Build in layers.

This project did not jump straight to a full-stack platform. It built the smallest useful version of the real idea:

- A model of people and ride groups.
- A way to add new records.
- A way to rank possible matches.
- A way to show capacity and status.
- A way to test the interface.

That is how good prototypes work.

They are not throwaway sketches. They are thinking tools.

A good prototype teaches you what the real app needs to become.

## How To Run The App

From the app directory:

```bash
cd ire_ride_connection_app
npm install
npm run dev
```

Then open the local URL printed by Vite, usually:

```text
http://localhost:5173/
```

If npm is pointed at a private registry and install fails, use:

```bash
npm_config_registry=https://registry.npmjs.org/ npm install
```

Then run:

```bash
npm run dev
```

For signed-in shared mode, the app also needs:

```bash
VITE_SUPABASE_URL=https://jihvnicnexakeyyxeyad.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

Those belong in `.env.local`, which should not be committed.

Supabase migrations are applied from the same app directory:

```bash
supabase db push --dry-run
supabase db push
supabase migration list
```

## How To Check The App

Useful commands:

```bash
npm run lint
npm run build
supabase db advisors --linked --type security --level info
```

Use `lint` to catch code quality problems.

Use `build` to confirm the production build works.

For visual checks, open the app in a browser and inspect:

- Desktop layout.
- Mobile layout.
- The entry form.
- Match ranking.
- Ride cards.
- Capacity meters.
- Save, contact, offer-help, and match actions.
- The `Your ride activity` panel.
- Per-slot contact and match state, including a case where one slot is matched and another remains pending.
- The how-to modal.
- The signed-in post removal flow.
- Admin CSV export, admin filters, and admin remove-post flow when MFA credentials are available.
- Status filtering.
- Signed-out sample mode.
- Signed-in Supabase mode, when credentials are available.

Do not skip visual inspection. Front-end bugs often live in the space between "the code is valid" and "the screen is useful."

## A Short Glossary

`participant`: A person using the app.

`ride group`: A carpool offer, carpool request, or Uber/Lyft split opportunity.

`host`: The person who created or anchors a ride group.

`riderIds`: Participants who have been matched into a group. In the database this is still stored through `ride_memberships`.

`matched_slots`: The selected conference trip slots that have been confirmed as matched for a participant in a ride group.

`inquiries`: The internal database name for participants who have marked contact or offered help but are not matched yet. In the UI, these are presented as contact/help markers.

`interest_slots`: The selected conference trip slots that a contact/help marker applies to.

`saved_slots`: The selected conference trip slots someone privately saved for later review.

`ride notification`: A best-effort email alert sent after contact/help is recorded. It tells the post owner to sign in and review the possible match; it does not replace direct email or phone coordination.

`admin activity`: A moderation log entry for actions such as status changes or post removal.

`corridor`: A regional route bucket, such as DC Northwest or Arlington/Alexandria.

`routeFlexibility`: How much geographic wiggle room a group has.

`capacity`: The maximum number of carpool seats or rideshare participants.

`effectiveStatus`: The status after accounting for capacity and manual closure. If a group has no open active slots, it is full even if the stored status says otherwise. If the stored status is manually `full`, it stays full until reopened.

`localStorage`: Browser-only storage used for signed-out sample mode.

`Supabase`: The hosted backend for auth, database storage, migrations, row-level security, and RPCs.

`one-time code`: A short-lived email code that signs a user in without a password.

`RLS`: Row-level security. Database rules that decide which rows a user can read or change.

`MFA`: Multi-factor authentication. Admins must verify a TOTP authenticator code before receiving admin-level database access.

`AAL2`: Supabase's session level showing that MFA has been verified.

## Final Takeaway

This app is a practical first version of a real coordination tool, now backed by Supabase for shared signed-in use.

It turns a spreadsheet into something more useful by understanding the shape of the problem: people, routes, time slots, seats, capacity, contact markers, and matches.

The current version is intentionally modest. It does not try to solve everything. It solves the core matching, status, auth, and shared-data problem clearly enough that the next technical decisions can be made with better information.

That is the rhythm of good software work:

1. Understand the real workflow.
2. Model the important pieces.
3. Build the smallest useful version.
4. Test it in the browser.
5. Fix what reality shows you.
6. Add complexity only when it earns its keep.
