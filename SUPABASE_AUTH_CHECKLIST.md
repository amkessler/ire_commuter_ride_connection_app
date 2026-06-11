# Supabase Auth Checklist

Use this checklist before public testing.

## Email Sign-In

The React app calls `signInWithOtp()`. Hosted Supabase email templates must be configured to send a numeric one-time code with `{{ .Token }}`. Returning users and first-time users can use different templates, so check both.

In the Supabase dashboard for `ire_commuter_rides`:

1. Open `Authentication` -> `URL Configuration`.
2. Confirm the production site URL is `https://ire-ride-connection-app.vercel.app`.
3. Confirm redirect URLs include `https://ire-ride-connection-app.vercel.app`, `http://localhost:5173`, and `http://localhost:3000` if older local auth links need to be tested.
4. Open `Authentication` -> `Emails`.
5. Open `Magic Link / OTP`.
6. Confirm the template includes `{{ .Token }}` and does not rely on `{{ .ConfirmationURL }}`.
7. Open `Confirm signup`.
8. Confirm that first-time users also receive `{{ .Token }}` instead of a confirmation link.
9. Send a login email from the app with a new email address.
10. Confirm the received code works in the app's `One-time code` field.
11. Send a login email from the app with a returning email address.
12. Confirm that received code also works in the app's `One-time code` field.

## Admin MFA

Admins are users listed in `public.admin_users`. Admin database privileges require an MFA-verified `aal2` session.

Before relying on admin tools:

1. Have the user sign in once so Supabase creates their Auth user record.
2. Add the user to `public.admin_users` by email:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where email = 'person@example.com'
on conflict do nothing;
```

3. Have the user sign out and sign back in.
4. Use `Set up admin MFA` if no TOTP factor exists.
5. Verify an authenticator code.
6. Confirm admin-only tools can load after verification.

To remove admin access:

```sql
delete from public.admin_users
where user_id in (
  select id
  from auth.users
  where email = 'person@example.com'
);
```

Replace `person@example.com` with the email the user uses to sign in.
