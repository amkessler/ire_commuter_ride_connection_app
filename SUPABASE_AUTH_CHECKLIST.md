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

## Ride Notification Emails

Inquiry, offer-help, and match emails are sent by the `send-ride-notification` Supabase Edge Function. Local code changes are not enough; the function must be deployed and configured in the linked Supabase project.

Before public testing:

1. Confirm migrations are current with `supabase migration list`.
2. Apply pending workflow migrations with `supabase db push --dry-run` and then `supabase db push`.
3. Deploy the function with `supabase functions deploy send-ride-notification`.
4. Set function secrets:

```bash
supabase secrets set RESEND_API_KEY=... NOTIFICATION_FROM_EMAIL='IRE Ride Connection <rides@example.org>' APP_PUBLIC_URL='https://your-app-url.example'
```

5. Send a test inquiry from one signed-in account to another and confirm the recipient receives email.

`APP_PUBLIC_URL` is optional, but it should be set before production launch so notification emails point users back to the live app.
