# Resend SMTP Setup Steps

Use this checklist before sharing the app publicly. Supabase's built-in email sender is rate-limited too tightly for real user sign-in, so production auth emails should use custom SMTP.

## 1. Add A Sending Domain In Resend

1. Open Resend.
2. Go to `Domains`.
3. Add the domain or subdomain that should send auth emails.
   - Prefer a subdomain such as `send.yourdomain.com` or `mail.yourdomain.com`.
   - Avoid changing root-domain email records unless you know they will not affect existing mail.
4. Copy the DNS records Resend provides.
5. Add those DNS records wherever the domain's DNS is managed.
6. Wait for Resend to mark the domain as verified.

## 2. Create A Resend API Key

1. In Resend, go to `API Keys`.
2. Create an API key for Supabase Auth SMTP.
3. Keep the key private.
4. Do not commit the key to this repo or paste it into frontend code.

## 3. Configure Supabase SMTP

1. Open Supabase.
2. Open the `ire_commuter_rides` project.
3. Go to `Authentication`.
4. Open `Email` under notifications/settings.
5. Open `SMTP Settings`.
6. Enable custom SMTP.
7. Enter the Resend SMTP settings:

```text
Host: smtp.resend.com
Port: 465
Username: resend
Password: your Resend API key
Sender email: rides@send.yourdomain.com
Sender name: IRE Commuter Ride Connection
```

Use the actual verified sender email for `Sender email`.

## 4. Check Supabase Auth Email Templates

In Supabase, go to `Authentication` -> `Emails`.

Check both templates:

1. `Magic Link / OTP`
2. `Confirm signup`

Both templates should send a numeric code using:

```text
{{ .Token }}
```

Do not rely only on:

```text
{{ .ConfirmationURL }}
```

The app expects users to copy a one-time code into the `One-time code` field. First-time users and returning users can hit different Supabase templates, so both templates need to be checked.

## 5. Check Supabase Redirect URLs

In Supabase, go to `Authentication` -> `URL Configuration`.

Set the production site URL:

```text
https://ire-ride-connection-app.vercel.app
```

Include redirect URLs:

```text
https://ire-ride-connection-app.vercel.app
http://localhost:5173
http://localhost:3000
```

`http://localhost:3000` is only needed for testing older local auth links that may already have been generated.

## 6. Test Before Public Sharing

1. Request a code with a brand-new email address.
2. Confirm the email contains a numeric code.
3. Enter the code in the app.
4. Confirm the app signs in and loads Supabase data.
5. Sign out.
6. Request another code for the same email address.
7. Confirm the returning-user email also contains a numeric code.
8. Enter the code and confirm sign-in works again.
9. Check Resend logs for delivery, bounces, spam complaints, or rejected messages.

## Notes

- Supabase's built-in email sender is only suitable for demos/testing because it has very low project-wide limits.
- Custom SMTP removes the built-in Supabase sender bottleneck, but Resend still has its own account, domain, reputation, and plan limits.
- Do not share screenshots or URLs that include Supabase access tokens.
