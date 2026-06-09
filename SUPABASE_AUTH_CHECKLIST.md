# Supabase Auth Checklist

Use this checklist before public testing.

## Email Sign-In

The React app calls `signInWithOtp()`. In the current Supabase setup, that sends a magic sign-in link because the project is on the free tier with Supabase's default email provider. Numeric code emails require custom SMTP or a paid plan that allows hosted email template edits.

In the Supabase dashboard for `ire_commuter_rides`:

1. Open `Authentication` -> `Emails`.
2. Open the passwordless login/confirmation email template.
3. Keep `{{ .ConfirmationURL }}` in the email body for magic-link sign-in.
4. Send a login email from the app.
5. Confirm the received link opens the app and signs the user in.

If the project later switches to numeric OTP emails, change the Magic Link / OTP template to include `{{ .Token }}` and confirm the received code works in the app's optional code field.

## Admin MFA

Admins are users listed in `public.admin_users`. Admin database privileges require an MFA-verified `aal2` session.

Before relying on admin tools:

1. Add the user's Supabase auth UUID to `public.admin_users`.
2. Sign in as that user.
3. Use `Set up admin MFA` if no TOTP factor exists.
4. Verify an authenticator code.
5. Confirm admin-only tools can load after verification.
