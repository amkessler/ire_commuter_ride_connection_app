# IRE Commuter Ride Connection

IRE Commuter Ride Connection is a lightweight web app for helping conference attendees coordinate rides to and from National Harbor, Maryland. Attendees can post one ride profile, browse likely matches, save options privately, and record confirmed ride connections after they have contacted each other.

The app is designed for practical coordination, not instant booking. It helps people find compatible routes and conference time slots, then lets them finish the conversation by email or phone.

## Live App

```text
https://ire-ride-connection-app.vercel.app
```

## What Attendees Can Do

- Sign in with an email one-time code.
- Add a ride profile with name, contact details, neighborhood, route corridor, travel mode, seats, and conference travel slots.
- Offer open carpool seats.
- Request a carpool seat.
- Start or join an Uber/Lyft split.
- Review likely matches ranked by route, travel mode, open capacity, and shared time slots.
- Save promising posts privately for specific trip slots.
- Reveal email or phone details when ready to contact someone.
- Record contact or a help offer after emailing or calling.
- Mark only the agreed trip slots as matched.
- Track saved rides, outgoing contact, incoming contact, and confirmed matches in one activity panel.

Signed-out visitors can explore the app with sample data before signing in.

## How Matching Works

The board compares each attendee's ride profile with available posts. Matching considers:

- Shared conference travel slots, such as `Thu AM`, `Fri PM`, or `Sun AM`.
- Regional corridors around DC, Virginia, and Maryland.
- Carpool offers, carpool requests, and Uber/Lyft split preferences.
- Open seats or group capacity.
- Ride status, including open, pending, matched, and full posts.

Match labels such as `Strong match`, `Good match`, and `Possible match` help sort the board. They do not block real-world flexibility. A post can still be saved or contacted even when the app warns that it is not a perfect fit.

## Key Features

### Contact-First Workflow

The app asks attendees to reveal contact details and record contact before marking a match. This keeps the board focused on coordination while allowing attendees to confirm pickup details outside the app.

### Slot-Level Ride Tracking

Actions are tracked by conference trip slot. Someone can save a ride for `Thu AM`, contact the host for `Thu PM`, and mark only `Fri AM` as matched. Open, pending, and matched states can exist separately on the same post.

### Private Saved Rides

Saving a post is private. It lets an attendee return to promising options without notifying the post owner.

### Sample Mode

When signed out, the app shows sample participants and ride posts so visitors can understand the experience without creating an account.

### Admin Tools

Authorized admins can use MFA-protected troubleshooting tools to preview participant perspectives, review board activity, filter posts, export CSVs, and remove stale or inappropriate posts.

## Tech Stack

- React 19
- Vite 7
- Supabase Auth, Postgres, RLS, RPCs, and Edge Functions
- `lucide-react` icons
- ESLint 9
- Vercel hosting

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview a production build:

```bash
npm run preview
```

Run linting:

```bash
npm run lint
```

## Environment Variables

Create `.env.local` for local Supabase-backed development:

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Without Supabase configuration, the app can still be explored with sample data.

## Repository Layout

```text
src/                                      React app source
src/App.jsx                              Main application UI and ride workflow
src/supabaseClient.js                    Supabase client setup
src/supabaseData.js                      Supabase data mapping and actions
supabase/migrations/                     Database migrations
supabase/functions/send-ride-notification Supabase Edge Function for email alerts
```

## Deployment

Production is hosted on Vercel from the GitHub repository's `main` branch. Vercel should provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for production and preview environments.
