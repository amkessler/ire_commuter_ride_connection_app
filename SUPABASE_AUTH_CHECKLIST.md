# Supabase Auth Checklist

Use this checklist before public testing.

## Email OTP

The React app calls `signInWithOtp()` and then verifies user-entered codes with `verifyOtp()`. That code-entry flow depends on the Supabase email template.

In the Supabase dashboard for `ire_commuter_rides`:

1. Open `Authentication` -> `Emails`.
2. Open the passwordless login/confirmation email template.
3. Add `{{ .Token }}` to the email body.
4. Keep `{{ .ConfirmationURL }}` if magic links should also work.
5. Send a login email from the app.
6. Confirm the received code works in the app's `One-time code` field.

The current Supabase CLI version on this machine does not expose email-template inspection, so this must be checked in the dashboard.

## Admin MFA

Admins are users listed in `public.admin_users`. Admin database privileges require an MFA-verified `aal2` session.

Before relying on admin tools:

1. Add the user's Supabase auth UUID to `public.admin_users`.
2. Sign in as that user.
3. Use `Set up admin MFA` if no TOTP factor exists.
4. Verify an authenticator code.
5. Confirm admin-only tools can load after verification.
