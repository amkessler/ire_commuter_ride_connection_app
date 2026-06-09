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

1. Add the user's Supabase auth UUID to `public.admin_users`.
2. Sign in as that user.
3. Use `Set up admin MFA` if no TOTP factor exists.
4. Verify an authenticator code.
5. Confirm admin-only tools can load after verification.
