# Repository Guidelines

## Project Structure & Module Organization

This is a React/Vite commuter ride app backed by Supabase.

- `src/` contains the browser app: `App.jsx`, `main.jsx`, Supabase helpers, and global styles in `styles.css`.
- `supabase/migrations/` contains schema, RLS, RPC, and policy migrations.
- `supabase/functions/send-ride-notification/` contains the notification Edge Function.
- Root config files include `package.json`, `vite.config.js`, `eslint.config.js`, and `index.html`.
- Product and operations notes live in `README.md`, `SUPABASE_AUTH_CHECKLIST.md`, and `RESEND_STEPS.md`.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` starts the Vite dev server on all interfaces.
- `npm run build` creates the production build in `dist/`.
- `npm run preview` serves the built app locally for smoke testing.
- `npm run lint` runs ESLint across the repository.
- `supabase db push --dry-run` previews pending database changes.
- `supabase db push` applies linked Supabase migrations.
- `supabase migration list` checks local and remote migration state.

## Coding Style & Naming Conventions

Use modern ES modules, React function components, and JSX. Follow the existing style: two-space indentation, double quotes, semicolons, descriptive camelCase variables, and PascalCase component names. Keep state and transformations readable in `App.jsx`. Use `lucide-react` icons where an icon button is appropriate.

For Supabase SQL, prefer explicit policy/function names. Migration filenames should follow `YYYYMMDDHHMMSS_short_description.sql`.

## Testing Guidelines

There is no dedicated automated test script in `package.json` yet. For frontend changes, run `npm run lint` and `npm run build`. For workflow changes, use the per-slot smoke test in `README.md`, especially after touching save, contact, match, or capacity logic. For database changes, run `supabase db push --dry-run` before applying migrations.

## Commit & Pull Request Guidelines

Commit history uses short, imperative messages such as `Restrict ride action RPC execution` and `Show post notes on ride cards`. Keep commits focused on one behavioral or documentation change.

Pull requests should include a summary, testing performed, linked issue or context, and screenshots or screen recordings for visible UI changes. For Supabase changes, call out migrations, policy/RPC changes, and any manual dashboard configuration required.

## Security & Configuration Tips

Keep browser Supabase values in `.env.local` and never commit secrets. Service-role keys, Resend API keys, and production secrets belong in Supabase or Vercel configuration. Review RLS policies and security-definer functions before changing grants.
