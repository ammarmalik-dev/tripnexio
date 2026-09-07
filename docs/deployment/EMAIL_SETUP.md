# Transactional email (Resend) — domain & DNS setup

This is the first deployment doc in the project (`docs/deployment/` didn't
exist before this). It only covers what's needed to turn on real outbound
email — see `CLAUDE.md`'s Stack section for the still-undocumented
Hostinger/Coolify app-deployment steps themselves.

The app already runs the full email pipeline in dev without any of this —
`src/lib/email/get-sender.ts` falls back to logging rendered emails to the
server console until `RESEND_API_KEY` is a real value. Nothing below is
required to develop or test the notification logic itself.

## 1. Create the Resend account and API key

1. The **client** signs up at [resend.com](https://resend.com) (or grants
   access to an existing account) — this is their account/billing, not ours.
2. Add a sending domain under **Domains** — recommend a subdomain dedicated
   to transactional mail (e.g. `mail.tripnexio.com` or `notify.tripnexio.com`)
   rather than the bare `tripnexio.com` apex, so email sending reputation is
   isolated from the main domain and any other mail already sent from it.
3. Resend shows the exact DNS records to add once the domain is created —
   add them at whichever registrar/DNS host manages `tripnexio.com`:
   - **SPF** — a `TXT` record (often merged into an existing `TXT`/`MX` setup
     if the domain already sends mail elsewhere — Resend's dashboard flags
     this if it detects a conflict).
   - **DKIM** — one or more `TXT` (or `CNAME`, depending on Resend's current
     setup flow) records under a `resend._domainkey` style subdomain. This is
     what actually lets receiving mail servers verify the message came from
     an authorized sender.
   - **DMARC** — Resend recommends adding this even though it doesn't
     enforce it directly; a basic monitoring policy (`p=none`) is a safe
     starting point that won't block mail while still surfacing spoofing
     attempts.
   - **Return-Path/tracking `CNAME`** — Resend's dashboard also asks for a
     `CNAME` (e.g. `bounce.mail.tripnexio.com` or similar, exact name shown
     per-domain) used for bounce/return-path handling.
4. Click **Verify** in the Resend dashboard once records propagate (can take
   anywhere from minutes to a few hours depending on the DNS host / TTLs).
   Do not set `RESEND_FROM_EMAIL` to an address on this domain until it
   shows **Verified** — sends from an unverified domain will fail or land
   in spam.
5. Create an API key under **API Keys** — scope it to "Sending access" only
   (not full account access) since that's all this app needs.

## 2. Configure the app

Set these two env vars in production (Coolify's environment-variables UI,
not committed to git — see `.env.example` for the placeholders):

```
RESEND_API_KEY="re_xxx..."                              # the key from step 1.5
RESEND_FROM_EMAIL="TripNexio <no-reply@mail.tripnexio.com>"   # must be on the verified domain from step 1
```

Once `RESEND_API_KEY` is a real (non-`TODO`) value, `getEmailSender()`
(`src/lib/email/get-sender.ts`) automatically switches from
`ConsoleEmailSender` to the real `ResendEmailSender` — no code change or
redeploy-time flag needed beyond setting the env vars.

## 3. Verify it end-to-end

1. Log into `/admin/notification-templates` as a staff account with
   `masters.manage`.
2. Open any **EMAIL** template, confirm it's **Active**, and use its
   **Send Test** action to send to a real inbox you control.
3. Confirm the email arrives (check spam on the first send — a brand-new
   sending domain has no reputation yet) and that `{{placeholder}}` values
   were substituted with the event's sample data.
4. Trigger a real event once satisfied (e.g. submit a test lead through one
   of the public request forms with a real email address) and confirm that
   email arrives too — the "Send Test" action exercises the same send path,
   but a real trigger also confirms the variable values pulled from the
   actual database record are correct.

## Known gap: no scheduler for time-based reminders

`QUOTE_REMINDER` (a reminder sent *before* a quote expires, as distinct from
`QUOTE_EXPIRED` which fires the moment it actually lapses) has a seeded
template but **no trigger** — there's no cron/background job anywhere in
this app (see `src/lib/quotations/sync-expiry.ts`'s doc comment: expiry is
checked lazily on read, not on a schedule). Sending a reminder *before* the
deadline needs something that runs independent of any request, which this
app doesn't have yet. Options for whoever picks this up:
- A scheduled task on the Hostinger VPS (`cron` + a small script hitting an
  internal endpoint) once deployment is set up.
- A hosted scheduler (e.g. a Coolify/Vercel cron-style trigger, or a
  third-party scheduler like Upstash QStash) calling a new authenticated
  endpoint that scans for quotations expiring soon and sends `QUOTE_REMINDER`.

Do not fabricate a fake "reminder" by, e.g., firing it at quote-creation
time with a delay — that's not what a scheduler is for and would either
block a request or silently never fire once the server process restarts.
