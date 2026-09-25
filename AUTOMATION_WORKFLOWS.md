# TripNexio Background Automation (n8n)

This explains what runs automatically in the background — no staff action needed — and why. It's written for the TripNexio team; the technical setup (installing n8n, importing these workflows, configuring the shared key) lives in `docs/deployment/N8N_SETUP.md`.

## Why this exists

Most of what TripNexio does happens in response to something — a customer submits a request, staff builds a quote, a payment comes in. But some things need to happen *because time has passed*, not because anyone did anything: a quote nobody's responded to eventually needs to lapse, a customer who abandoned a payment page might just need a nudge, a traveler's documents might still be missing as their flight approaches. Nothing inside the TripNexio app itself can do this on its own — a website only runs code when someone visits it. **n8n** is a separate, always-on automation tool that runs on a schedule and calls TripNexio's own APIs to do this work, the same way a staff member would, just automatically.

Every one of these workflows is visible to the team at **Admin → Automation** — showing when each one last ran, whether it succeeded, and what it did.

## The seven workflows

### 1. Quote Expiry Handling
**Runs every 15 minutes.** Calls `POST /api/automation/quote-expiry`.

- Any quote whose validity window has actually passed gets marked expired, and the customer gets an automatic "your quote has expired" message (email + WhatsApp, same as if staff had done it) — this used to only happen if someone opened the CRM and looked at that specific lead; now it happens on its own.
- Any quote that's about to expire (within 15 minutes) gets a one-time reminder nudge first, so the customer has a chance to respond before it lapses.

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

## What each workflow actually sends

Every message the first five workflows send uses the **same Admin-managed templates** as everything else in the CRM (Admin → Notification Templates) — `QUOTE_REMINDER`, `PAYMENT_REMINDER`, `DOCUMENTS_REQUIRED`, `LEAD_FOLLOWUP`, and `VISA_EXTENSION_REMINDER`. Editing the copy there changes what these automatic messages say, exactly like it does for the notifications staff-triggered actions send. The same email/WhatsApp rules apply too — a WhatsApp reminder only actually sends once its template has been approved by Meta (see `docs/deployment/WHATSAPP_SETUP.md`); until then, only the email version goes out. The sixth workflow (Document Retention Purge) doesn't send a customer message at all — it only deletes files.

## No spam, guaranteed

Each of the first five jobs runs on a tight schedule (as often as every 15 minutes), but nobody gets the same reminder over and over. The app itself tracks "have I already reminded about this specific thing" and skips anything already handled — a quote only ever gets one reminder before it either converts or expires; a stalled request's periodic nudge waits a few days between each one; a Visa Extension booking only ever gets its Day-25 reminder once. This is enforced by the app, not by n8n's schedule, so it stays correct even if a workflow's timing changes later. The Document Retention Purge job has its own equivalent safeguard: once a document's file is purged, it's marked as such and never considered again on a future run.

## How to see if it's working

**Admin → Automation** shows all seven workflows with their last run time and whether it succeeded — this is the first place to check if reminders seem to have stopped going out. A workflow that's never appeared there hasn't been connected in n8n yet (see the setup doc). A workflow showing "Failure" with an error message means something needs attention — the error text explains what went wrong.
