# TripNexio Background Automation (n8n)

This explains what runs automatically in the background — no staff action needed — and why. It's written for the TripNexio team; the technical setup (installing n8n, importing these workflows, configuring the shared key) lives in `docs/deployment/N8N_SETUP.md`.

## Why this exists

Most of what TripNexio does happens in response to something — a customer submits a request, staff builds a quote, a payment comes in. But some things need to happen *because time has passed*, not because anyone did anything: a quote nobody's responded to eventually needs to lapse, a customer who abandoned a payment page might just need a nudge, a traveler's documents might still be missing as their flight approaches. Nothing inside the TripNexio app itself can do this on its own — a website only runs code when someone visits it. **n8n** is a separate, always-on automation tool that runs on a schedule and calls TripNexio's own APIs to do this work, the same way a staff member would, just automatically.

Every one of these workflows is visible to the team at **Admin → Automation** — showing when each one last ran, whether it succeeded, and what it did.

## The workflows

### 1. Quote Expiry Handling
**Runs every 5 minutes.** Calls `POST /api/automation/quote-expiry`.

- Any quote whose validity window has actually passed gets marked expired, and the customer gets an automatic "your quote has expired" message (email + WhatsApp, same as if staff had done it) — this used to only happen if someone opened the CRM and looked at that specific lead; now it happens on its own.
- Flight Special Fare quotes (max 30-minute validity, per that service's own locked spec) get a reminder nudge every 10 minutes while still valid — not just once — since their quote window is short enough that one reminder isn't enough of a nudge.
- Every other service's quote gets a one-time reminder nudge when it's about to expire (within 15 minutes), so the customer has a chance to respond before it lapses.

### 2. Payment Follow-up Reminders
**Runs every hour.** Calls `POST /api/automation/payment-followup`.

- A payment link that's genuinely expired (past its own deadline) gets marked as such in the system, so staff can see at a glance it needs a fresh one rather than assuming the customer is still able to pay.
- A payment that's been sitting unpaid for a couple of hours gets a one-time reminder nudge — many customers simply get distracted before finishing a payment; a gentle nudge recovers some of these.

### 3. OTB Requirement Checks
**Runs daily at 9:00 AM.** Calls `POST /api/automation/otb-requirement-check`.

- As an OTB traveler's flight date gets close (within a week), if they still haven't submitted a required document, they get a reminder — the same "document required" message staff would normally trigger, just sent again automatically as the deadline nears instead of only once at the start.

### 4. Periodic Service Follow-ups
**Runs daily at 10:00 AM.** Calls `POST /api/automation/lead-followup`.

- A request that's been sitting without any progress for a few days (not yet quoted, or quoted but the customer hasn't responded) gets a friendly "still interested?" nudge. Unlike the other three (which each customer gets at most once), this one can repeat periodically — as long as a request stays stalled, it'll get another gentle nudge every few days.

### 5. Document Retention Purge
**Runs weekly, Sunday at 3:00 AM.** Calls `POST /api/automation/document-retention`.

This one is different from the other four — it doesn't send anything, it **deletes files**. Once a booking is fully done (completed, cancelled, or refunded) and 3 months have passed, the documents a customer uploaded for it are no longer needed — except their Passport photo and Visa copy/PDF, which TripNexio keeps. Everything else's underlying file is deleted; the record that a document of that type existed stays (so the booking's history still shows what was uploaded), only the file itself is removed.

**Before this job ever runs for real:** call it once with `{"dryRun": true}` in the request body and check the `wouldPurge`/`wouldPurgeDocumentIds` numbers look right — it reports exactly what it would delete without touching anything. The imported workflow ships with a reminder about this in the HTTP node's own notes.

### 6. Visa Extension: Day-25 Re-Extension Reminder
**Runs daily at 9:00 AM.** Calls `POST /api/automation/visa-extension-reminder`.

- Once a Visa Extension booking has actually been paid for and completed, the new 30-day extension is counted from the customer's original visa expiry date. Around day 25 of that window (5 days before it lapses), the customer gets a one-time reminder that they may want to extend again — the same idea as the payment/document reminders, just for the extension's own expiry instead.

### 7. Audit Trail Retention
**Runs weekly, Sunday at 4:00 AM — but only ever reports, never deletes, until told otherwise.** Calls `POST /api/automation/audit-retention`.

- The Admin System Configuration screen has an "Audit Retention (days)" setting, but nothing has ever actually acted on it. This workflow is the one that would — except it's deliberately shipped in **dry-run mode only**: it reports exactly how many audit-trail rows are older than the configured retention window (visible at Admin → Automation) without deleting a single one.
- **This stays dry-run until we've explicitly confirmed with you** whether "retention" should mean permanently deleting those old rows, or archiving them somewhere first. Audit trail entries are often exactly what's needed to resolve a customer dispute or answer a compliance question later, so we didn't want to guess and risk deleting something that turns out to matter. Once you've told us which you want, flipping this to actually delete (or archive) is a one-line change to the n8n workflow.

### 8. Document Reminders
**Runs daily at 11:00 AM.** Calls `POST /api/automation/document-reminder`.

- For every service: while a booking is still waiting on a customer document (required, flagged missing, or rejected and needing a new upload), the customer gets one reminder every 24 hours listing what's outstanding, with the secure link to upload it.
- It stops on its own as soon as the documents are uploaded or verified, and it never goes to a cancelled, refunded or completed booking, or to a closed request. The 24-hour spacing is enforced by the app, so running the workflow more often never sends more.

### 9. Return Ticket: Auto-complete After Travel
**Runs daily at 6:00 AM.** Calls `POST /api/automation/return-ticket-auto-complete`.

- A Return Verified Ticket booking whose reservation/ticket PDF has been delivered moves to **Completed** once its travel date has passed, plus the number of days set in Admin → Timelines ("Auto-complete: days after travel date"; 0 when not set). A booking on hold, cancelled, refunded or already completed is never touched. It sends no reminder — only the normal status update, if a notification is configured for the Completed status.

### 10. Staff Alerts: Follow-ups Due & Delayed Bookings
**Runs every hour.** Calls `POST /api/automation/staff-alerts`.

- This one never messages a customer — it fills the CRM's own **Notifications** panel for your team. When a task (a follow-up, a document to collect, etc.) is due today or already overdue, the person it's assigned to (or the lead's assigned staff member) gets a "Due today"/"Overdue" notification. At most once a day per task.
- When a booking runs past its SLA (the same definition the CRM's **Delays** page uses, from Admin → Timelines / SLA), the lead's assigned staff member — or, if nobody is assigned, everyone who can see bookings for that service — gets a "Delayed booking" notification. At most once a week per booking while it stays delayed.
- The once-a-day / once-a-week spacing is enforced by the app, so running the workflow more often never sends more.

### 11. SLA Escalation: Bookings Stuck in a Status
**Runs every hour.** Calls `POST /api/automation/sla-escalation`.

- Uses the rules set in **Admin → SLA Escalation**. Each rule names a service (or every service), a status (or any status that isn't final), a number of hours, and who to escalate to — **Managers** (anyone who can manage staff) or **Admins** (full admin access).
- When an open booking has sat in that status longer than the hours set — counted from the last time its status changed, or from when the booking was created if it never changed — those people get an "Escalation: <booking> in <status> for N h" notification in the CRM's **Notifications** panel, linking to the booking, and a "SLA escalated" entry is added to the booking's history. Only people who can see that service are notified.
- It never messages a customer. Each booking is escalated **once per rule for each stay in a status**: if it moves on and later comes back to the same status, the clock starts again.

### 12. Abandoned Quotation Coupons
**Runs every hour.** Calls `POST /api/automation/abandoned-quote-coupons`. Workflow file: `n8n/workflows/abandoned-quote-coupons.json`.

- **Off by default.** It only does anything once an Admin turns it on in **Admin → Coupons → Abandoned-Quotation Coupon** and sets the coupon type (percentage or fixed amount), value, optional maximum discount, how many hours to wait, and how many days the coupon stays valid. The app won't let it be switched on until those are set.
- A request qualifies when its latest quotation that was actually sent to the customer (not a draft) has expired, **or** its booking payment is still unpaid (pending, expired or failed, with no successful payment) — in either case more than the configured number of hours after the quotation/payment was created.
- It is never sent for a request that is Converted, Lost or Closed, to a customer who opted out of follow-ups, or for a request that already has a successful payment.
- The customer gets **one single-use coupon** (a random code, category "Abandoned quotation", usable once, valid from now for the configured number of days, with the configured maximum discount) by email and WhatsApp using the `ABANDONED_QUOTE_COUPON` template in Admin → Notification Templates. The coupon only works on that customer's own request — entering it on any other request is rejected.
- At most **one coupon per request, ever**: the app checks whether it already generated an abandoned-quotation coupon for that request before creating another, so running the workflow more often never sends more. Every coupon created is recorded in the request's history and in the audit trail, and appears in Admin → Coupons.

## Running the schedule: n8n or Vercel Cron

The workflows above can be triggered by **either** of two schedulers — both call the exact same `/api/automation/*` routes, so the behaviour, the "no spam" guarantee and Admin → Automation monitoring are identical whichever one you use:

- **n8n** (or any VPS cron) — `POST` with `Authorization: Bearer <AUTOMATION_API_KEY>`. Still fully supported; see `docs/deployment/N8N_SETUP.md` and `n8n/workflows/*.json`.
- **Vercel Cron** — configured in `vercel.json` (`"crons"`). Vercel sends a `GET` with `Authorization: Bearer <CRON_SECRET>`. Set `CRON_SECRET` in the Vercel project's Environment Variables (Production) and redeploy; until it's set, Vercel's calls are rejected (safe-closed).

Don't run both schedulers against the same deployment at full frequency — it's safe (the app de-duplicates reminders) but wasteful.

**Vercel plan limit:** on the **Hobby** plan each cron job runs **at most once a day** (and only within the scheduled hour, not the exact minute). The sub-daily schedules below (every 5 minutes, hourly) need **Vercel Pro** — otherwise keep n8n or a VPS cron for those jobs.

Vercel cron expressions are always **UTC**. India Standard Time is UTC+5:30, so the times below were converted (JSON can't hold comments, so this table is the reference for `vercel.json`):

| Route | Vercel schedule (UTC) | Equivalent IST | Notes |
|---|---|---|---|
| `/api/automation/quote-expiry` | `*/5 * * * *` | every 5 min | needs Pro |
| `/api/automation/payment-followup` | `5 * * * *` | hourly at :35 | needs Pro |
| `/api/automation/staff-alerts` | `0 * * * *` | hourly at :30 | needs Pro |
| `/api/automation/sla-escalation` | `15 * * * *` | hourly at :45 | needs Pro |
| `/api/automation/abandoned-quote-coupons` | `45 * * * *` | hourly at :15 | needs Pro |
| `/api/automation/return-ticket-auto-complete` | `30 0 * * *` | daily 06:00 | |
| `/api/automation/otb-requirement-check` | `30 3 * * *` | daily 09:00 | |
| `/api/automation/visa-extension-reminder` | `45 3 * * *` | daily 09:15 | |
| `/api/automation/lead-followup` | `30 4 * * *` | daily 10:00 | also covers the Flight Special Fare every-7-days follow-up |
| `/api/automation/document-reminder` | `30 5 * * *` | daily 11:00 | |
| `/api/automation/document-retention` | `30 21 * * 6` | weekly, Sunday 03:00 | |
| `/api/automation/audit-retention` | `30 22 * * 6` | weekly, Sunday 04:00 | a body-less call (Vercel's GET) runs as a **dry run** — reports what would be purged, deletes nothing. Real purges still need an explicit `POST {"dryRun": false}` (e.g. from n8n). |

## What each workflow actually sends

Every message the first five workflows send uses the **same Admin-managed templates** as everything else in the CRM (Admin → Notification Templates) — `QUOTE_REMINDER`, `PAYMENT_REMINDER`, `DOCUMENTS_REQUIRED`, `LEAD_FOLLOWUP`, and `VISA_EXTENSION_REMINDER`. Editing the copy there changes what these automatic messages say, exactly like it does for the notifications staff-triggered actions send. The same email/WhatsApp rules apply too — a WhatsApp reminder only actually sends once its template has been approved by Meta (see `docs/deployment/WHATSAPP_SETUP.md`); until then, only the email version goes out. The sixth workflow (Document Retention Purge) doesn't send a customer message at all — it only deletes files.

## No spam, guaranteed

Each of the first five jobs runs on a tight schedule (as often as every 15 minutes), but nobody gets the same reminder over and over. The app itself tracks "have I already reminded about this specific thing" and skips anything already handled — a quote only ever gets one reminder before it either converts or expires; a stalled request's periodic nudge waits a few days between each one; a Visa Extension booking only ever gets its Day-25 reminder once. This is enforced by the app, not by n8n's schedule, so it stays correct even if a workflow's timing changes later. The Document Retention Purge job has its own equivalent safeguard: once a document's file is purged, it's marked as such and never considered again on a future run.

## How to see if it's working

**Admin → Automation** shows every workflow with their last run time and whether it succeeded — this is the first place to check if reminders seem to have stopped going out. A workflow that's never appeared there hasn't been connected in n8n yet (see the setup doc). A workflow showing "Failure" with an error message means something needs attention — the error text explains what went wrong.
