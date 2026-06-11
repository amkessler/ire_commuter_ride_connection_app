# Supabase Auth Checklist

Use this checklist before public testing.

## Email Sign-In

The React app calls `signInWithOtp()`. The hosted Supabase email template is configured to send a numeric one-time code with `{{ .Token }}`.

In the Supabase dashboard for `ire_commuter_rides`:

1. Open `Authentication` -> `Emails`.
2. Open the passwordless login/confirmation email template.
3. Confirm the template includes `{{ .Token }}`.
4. Send a login email from the app.
5. Confirm the received code works in the app's `One-time code` field.

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
