# TripNexio Background Automation (n8n)

This explains what runs automatically in the background — no staff action needed — and why. It's written for the TripNexio team; the technical setup (installing n8n, importing these workflows, configuring the shared key) lives in `docs/deployment/N8N_SETUP.md`.

## Why this exists

Most of what TripNexio does happens in response to something — a customer submits a request, staff builds a quote, a payment comes in. But some things need to happen *because time has passed*, not because anyone did anything: a quote nobody's responded to eventually needs to lapse, a customer who abandoned a payment page might just need a nudge, a traveler's documents might still be missing as their flight approaches. Nothing inside the TripNexio app itself can do this on its own — a website only runs code when someone visits it. **n8n** is a separate, always-on automation tool that runs on a schedule and calls TripNexio's own APIs to do this work, the same way a staff member would, just automatically.

Every one of these workflows is visible to the team at **Admin → Automation** — showing when each one last ran, whether it succeeded, and what it did.

## The four workflows

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

## What each workflow actually sends

Every message these workflows send uses the **same Admin-managed templates** as everything else in the CRM (Admin → Notification Templates) — `QUOTE_REMINDER`, `PAYMENT_REMINDER`, `DOCUMENTS_REQUIRED`, and `LEAD_FOLLOWUP`. Editing the copy there changes what these automatic messages say, exactly like it does for the notifications staff-triggered actions send. The same email/WhatsApp rules apply too — a WhatsApp reminder only actually sends once its template has been approved by Meta (see `docs/deployment/WHATSAPP_SETUP.md`); until then, only the email version goes out.

## No spam, guaranteed

Each of these jobs runs on a tight schedule (as often as every 15 minutes), but nobody gets the same reminder over and over. The app itself tracks "have I already reminded about this specific thing" and skips anything already handled — a quote only ever gets one reminder before it either converts or expires; a stalled request's periodic nudge waits a few days between each one. This is enforced by the app, not by n8n's schedule, so it stays correct even if a workflow's timing changes later.

## How to see if it's working

**Admin → Automation** shows all four workflows with their last run time and whether it succeeded — this is the first place to check if reminders seem to have stopped going out. A workflow that's never appeared there hasn't been connected in n8n yet (see the setup doc). A workflow showing "Failure" with an error message means something needs attention — the error text explains what went wrong.
