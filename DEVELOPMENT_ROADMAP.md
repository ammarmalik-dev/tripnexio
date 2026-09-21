# TripNexio — Development Roadmap (Client-Locked Spec Alignment)

**Source:** `client-message/AUDIT_REPORT.md` (2026-09-07 read-only audit of the client's locked requirement docs vs. the built codebase).
**Purpose:** A sequential, one-unit-at-a-time build plan to bring the platform into alignment with the client's actual locked business rules. Each step below is self-contained — copy the "Prompt to use" block and hand it to Claude Code as its own task. Do not skip ahead; some later steps depend on earlier ones (noted).

**How to use this file:** Work top to bottom. After each step is built and verified, come back here, check it off, and move to the next. Per `CLAUDE.md`'s hard rules, each step should be its own reviewed unit — do not batch multiple steps into one session unless a step says it's small enough to combine.

---

## Phase 0 — Critical/Financial Fixes (do these first, before anything else)

These are live, financially-material conflicts with the client's locked rules. Low effort, high risk if left as-is.

### Step 1 — Turn GST off by default
**Audit ref:** §7.7 (CONFLICTING — high priority)
**Problem:** Client's locked rule: *"Current: GST OFF, invoice non-GST."* The app currently charges a live 5% GST on every payment and always shows a GST line on invoices.

**Prompt to use:**
> "Fix the GST conflict from the audit report (§7.7). The client's locked rule is GST OFF by default. Update the `TaxFeeConfig` seed/default to 0% GST, and make the invoice PDF (`src/lib/invoices/render-invoice.ts`) omit the GST line entirely when the rate is 0% instead of always showing 'GST: ₹0'. Keep the admin UI (`/admin/tax-fee`) able to turn GST back on later when the client is ready — don't remove the capability, just default it off. Verify with a fresh payment that no GST is charged or shown."

---


### Step 2 — Fix the OTB refund figure (₹500 → ₹250)
**Audit ref:** §7.4, §2.6 (CONFLICTING)
**Problem:** `OTB.md` locks the post-validation refund deduction at ₹250; the code has a placeholder `SAMPLE_OTB_FIXED_SERVICE_CHARGE = 500`.

**Prompt to use:**
> "Fix `SAMPLE_OTB_FIXED_SERVICE_CHARGE` in the refund calculator — change it from 500 to 250 to match the real locked figure from `client-message/OTB.md`. Rename the constant to drop the SAMPLE_ prefix since this is now a confirmed real value, not a placeholder. Verify the refund math with a test OTB refund."

---

### Step 3 — Close the refund self-approval gap
**Audit ref:** §3.5 (CONFLICTING)
**Problem:** `CRM.md` §21: *"CRM raises, Admin approves/rejects — CRM cannot approve its own refund."* Today, any staff with `refunds.edit` (which the default Staff role has) can walk a refund all the way to COMPLETED alone.

**Prompt to use:**
> "Implement Admin-only refund approval per CRM.md §21: CRM staff can create/calculate a refund (stays PENDING) but only a user with `admin.full` or a new dedicated `refunds.approve` permission can move it to PROCESSING/COMPLETED/REJECTED. Update `PATCH /api/refunds/[id]/status` to enforce this, and update `RefundStatusControl.tsx` so ordinary staff see the refund as pending-approval, not actionable. Don't remove the default Staff role's ability to raise/calculate a refund — only gate the approval transition. Verify: a Staff-role user can create a refund but gets 403 trying to approve it; an Admin can approve it."

---


### Step 4 — Close the lead self-reassignment gap
**Audit ref:** §3.11 (CONFLICTING)
**Problem:** `CRM.md` §34 / `ADMIN.md` §12: *"normal CRM staff CANNOT assign/reassign... Admin CAN."* Today `leads.edit` (default Staff permission) allows any staff to reassign any lead.

**Prompt to use:**
> "Implement Admin-only lead reassignment per CRM.md §34/ADMIN.md §12: split lead assignment into two cases — initial assignment (any staff with leads.edit can claim/assign an unassigned lead) vs. reassignment (moving a lead that's already assigned to someone else). Reassignment should require `admin.full` or a new `leads.reassign` permission. Update `PATCH /api/leads/[id]/assign` and `LeadAssignmentControl.tsx` accordingly. Verify with both a Staff-role and Admin-role user."

---

## Phase 1 — Foundational Architecture Decisions (confirm with client, then build)

These require either a direct decision from the client or a deliberate migration — don't guess silently, per the project's own "OPEN QUESTION" convention.

### Step 5 — Decide and implement the Lead-ID-becomes-Booking-ID architecture
**Audit ref:** §7.2 (CONFLICTING — highest-priority structural gap)
**Problem:** `CRM.md` requires one continuous identifier that changes state from Lead to Booking, never a second unrelated ID. Today there are three separate ID schemes (Lead cuid, Lead reference string, Booking reference string).

**Before building:** Confirm with the client whether they want (a) the same human-readable reference (e.g. `OTB-JYOQHX`) to literally become the Booking's reference at payment success (simplest, closest to the letter of the rule), or (b) a deeper schema change merging Lead and Booking into one continuously-evolving record. Option (a) is almost certainly what they mean and is much cheaper — recommend it unless told otherwise.

**Prompt to use (once confirmed):**
> "Implement the Lead-ID-becomes-Booking-ID rule from CRM.md §5/§7/§19: when a Booking is created from a Lead, its `bookingId` should be derived from the Lead's own reference (e.g. Lead `OTB-JYOQHX` → Booking `OTB-JYOQHX`, or with a minimal marker if a service-code prefix is still needed), not a newly-generated random placeholder. Update `src/lib/bookings/reference.ts` and the booking-creation flow so the Lead reference carries through instead of generating an unrelated new ID. Keep backward compatibility in mind for any already-created bookings in the dev DB. Verify end-to-end: create a lead, note its reference, create a booking from it, confirm the booking's reference matches/derives from the lead's."

---


### Step 6 — Service/Country configurability (RESOLVED: client wants flexibility)

**Audit ref:** §4.3, §4.2 (CONFLICTING) — **Client decision (2026-09-08): wants the ability to add new countries/services in the future AND edit the existing ones. Confirmed, not still open.**

**Honest scoping note before building** (per the project's own OPEN QUESTION convention — don't silently over-promise): "add a country" and "add a service" are NOT equally easy to make fully code-free, and the sub-steps below are scoped accordingly:
- **Countries have no differentiated business logic** — a country is just a classification used by Airport/Border masters and a destination dropdown. Making Country **fully dynamic** (add/edit/disable, zero code, zero deploy) is completely achievable and is exactly what Step 6.1 delivers.
- **Services each have materially different business rules** — different request-form fields, different lead-intake validation, different quote-builder shape, different WhatsApp bot flow. No reasonably-scoped implementation can make a *brand-new* service (its forms/validation/flows) appear with zero developer code — that requires a full generic workflow/form-builder engine, which is its own large project, not a fit for the current scope/budget. What **is** fully achievable (Step 6.2): every existing service's *metadata* (name, description, icon, display order, on/off) becomes Admin-editable with zero deploys, and a `Service` table exists so any future new service's code registers into it instead of needing a Prisma enum migration. Flagging this clearly now rather than discovering it as a surprise later.

Two sub-steps, build in order:

#### Step 6.1 — Country as a fully dynamic Admin-managed master
**Prompt to use:**
> "Replace the fixed `GccCountry` Prisma enum with a real Admin-managed `Country` model (code, name, active, displayOrder) — no code deployment should ever be needed again to add/edit/disable a country. Seed it with the 6 current locked GCC countries plus India (these are real confirmed values from CLAUDE.md's own locked scope, not placeholders). Migrate `Airport.gccClassification` and `Border.side` from the enum to a `countryId` FK. Build a new `/admin/countries` CRUD screen (masters.manage-gated, same enable/disable pattern as Airports/Airlines/Borders — no delete, since Airport/Border rows may reference it). Add a public `GET /api/countries` (active-only, ordered) and wire the website's destination-country dropdowns (currently `DESTINATION_COUNTRY_OPTIONS` in `sample-data.ts`) to fetch from it instead of a hardcoded array. Verify: add a new country via Admin, confirm it appears in the website dropdown and in the Airport/Border Admin forms with no code change or restart."

#### Step 6.2 — Service metadata as an Admin-managed master
**Prompt to use:**
> "Add a `Service` model (code, name, shortDescription, icon, active, displayOrder) as an Admin-editable metadata layer over the 6 existing services — seed it with the real 6 locked services (New Visa, Visa Extension, Visa Change, Flight Special Fare, Return Verified Ticket, OTB), matching the existing `ServiceType` enum's string values as `Service.code` exactly. This does NOT replace the `ServiceType` enum used for business-logic type-safety across Lead/Quotation/Booking-reference/DocumentRequirement/PricingRule/Faq — that stays as-is; this is a parallel, Admin-editable presentation/metadata layer. Build `/admin/services` CRUD (masters.manage-gated, enable/disable, reorder — no delete). Replace the homepage's hardcoded `services-config.ts` grid with a fetch from a new public `GET /api/services` (active-only, ordered), so renaming, reordering, or disabling a service (e.g. temporarily hiding OTB) takes effect live with zero deploys. Verify: rename/reorder/disable a service via Admin, confirm the homepage services grid reflects it immediately."

---


## Phase 2 — Missing Customer-Facing Service Frontends

**Audit ref:** §2.2–2.5, punch-list #6. The backend/API already exists for all four — this is purely frontend work, following the exact pattern already proven for OTB and New Visa (`MultiStepRequestFlow`, shared field primitives — see `CLAUDE.md`'s "Progress so far — Service request flows" section).

Build one at a time, in this order (matches spec richness / business priority):

### Step 7 — Visa Extension frontend
**Prompt to use:**
> "Build the Visa Extension customer-facing request flow at `/services/visa-extension` and `/services/visa-extension/request`, following the exact same pattern as New Visa (`NewVisaRequestFlow.tsx`) — reuse `MultiStepRequestFlow`, the existing `visa-extension-schema.ts`, and the existing working `POST /api/leads/visa-extension` route. Before wiring the form, re-read `client-message/Visa_Extension.md` and add the locked business rules that are currently missing from the API layer: (1) the eligibility gate — a visa is only extendable if it was originally issued through TripNexio, requiring a lookup against the customer's own prior visa bookings, with a clear redirect to Visa Change (if inside UAE) or New Visa (if outside UAE) on no match; (2) the same-day-expiry 6PM cutoff and the ≥30-day-expired permanent ineligibility rule. Flag anything still unclear as an OPEN QUESTION rather than guessing. Verify the full flow end-to-end including the eligibility rejection path."

---


### Step 8 — Visa Change frontend
**Prompt to use:**
> "Build the Visa Change customer-facing request flow at `/services/visa-change` and `/services/visa-change/request`, reusing `MultiStepRequestFlow` and the existing `visa-change-schema.ts` (the discriminated union on A2A vs. Border) and `POST /api/leads/visa-change` route, which already does live Airport/Border master lookups. Re-read `client-message/Visa_Change.md` first and confirm/add the mandatory Border-side fields (Pickup Location, Reporting Time, Pickup Person Name, Customer Contact Number) with a hard gate — no package should be generatable without all four. Do not build the two-phase pricing gate or PDF package generation in this step — that's separate CRM-side work (later steps). Verify the full flow for both A2A and Border paths."

---


### Step 9 — Flight Special Fare frontend
**Prompt to use:**
> "Build the Flight Special Fare customer-facing request flow at `/services/flight-special-fare` and `/services/flight-special-fare/request`, reusing `MultiStepRequestFlow` and the existing schema/route. Re-read `client-message/Flight_Special_Fare.md` and implement the DOB-based Adult(12+)/Child(2-11)/Infant(<2) passenger typing on the frontend — note the audit found the `PaxType` enum is missing an `INFANT` value even though `infantFare` exists as a quote field; add `INFANT` to the enum as part of this step (small Prisma migration) so the frontend can actually record it. Enforce the 45-day max travel window client-side (mirroring server-side validation in the schema). Verify the full flow including an infant passenger."

---


### Step 10 — Return Verified Ticket frontend
**Prompt to use:**
> "Build the Return Verified Ticket customer-facing request flow at `/services/return-ticket` and `/services/return-ticket/request`, reusing `MultiStepRequestFlow` and the existing schema/route. Re-read `client-message/Return_Verified_Ticket.md` first — the locked rule is the customer selects ONLY a travel date; the return/onward date is system-generated from a 30-day or 60-day rule depending on visa type, not manually entered by the customer (the audit flagged the current schema/route as not confirmed to implement this). Update the schema and route to compute the return date server-side instead of accepting it as user input, and update the frontend accordingly. Also implement the 24-hour issue-then-expire reservation window as a new booking-level status/expiry field if one doesn't already exist. Verify the full flow, including confirming the return date is genuinely computed, not customer-entered."

---

## Phase 3 — CRM Core Gaps

### Step 11 — Build the CRM Command Centre / dashboard
**Audit ref:** §3.10, punch-list #7
**Prompt to use:**
> "Build the CRM home dashboard at `/crm` (currently a bare redirect to `/crm/leads`), following `client-message/CRM.md` §4's spec: Sales Overview KPIs (New/Hot/Warm/Cold/Qualified lead counts, conversion rate), Operations Overview KPIs (pending documents, expiring quotes, pending payments, open refunds), a period filter, and a 'Most Action Required' priority queue (e.g. quotes expiring soon, documents flagged missing, leads with no activity). Query real data from the existing Lead/Quotation/Payment/Refund/Document tables — don't fabricate numbers. This becomes the new default `/crm` landing page, replacing the redirect. Keep it read-only/reporting for this step — don't add new mutation actions here."

---


### Step 12 — Add lead temperature + reorganize CRM navigation
**Audit ref:** §3.1
**Prompt to use:**
> "Add a `LeadTemperature` field (Cold/Warm/Hot) to the `Lead` model per CRM.md §5, settable by staff on the lead detail page and filterable on the Leads list. Also reorganize the CRM sidebar nav (`src/lib/crm/nav-config.ts`) into the grouped structure CRM.md §3 describes — Command Centre / Sales (Leads, Customers, Quotations) / Operations (Bookings, Payments, Refunds, Documents) — rather than the current flat list. This is primarily a navigation/schema change, not new business logic. Verify the nav renders correctly and temperature filtering works on the Leads list."

---

### Step 13 — Add a standalone Quotations list screen
**Audit ref:** §3.2
**Prompt to use:**
> "Replace the `<CrmComingSoon>` placeholder at `/crm/quotations` with a real standalone list screen — the full CRUD API already exists (`/api/quotations`), it just needs a list UI mirroring `LeadsTable.tsx`'s pattern (filters, search, loading/empty/error states). Show lead reference, service, status (selected/expired/pending), selling price, margin (internal-only, marked as such), and created date, with a link through to the parent lead. Verify it renders real data and the internal-only fields are visually marked."

---

### Step 14 — Per-passenger booking status + partial refunds
**Audit ref:** §3.3, §3.5 (CONFLICTING)
**Prompt to use:**
> "Address two related CRM.md-locked rules in one unit: (1) §12 requires each passenger on a multi-passenger booking to have independently visible status, not one combined booking-level status — add a `BookingPassenger` join model (or equivalent) carrying a per-passenger status alongside the existing per-passenger Document linkage; (2) §21 requires refunds to be raisable against a specific subset of passengers, not the whole booking — add an optional passenger-list field to the `Refund` model and update the refund calculator/UI to let staff select which passengers a refund applies to. This is a real schema change — plan the migration carefully and keep the existing booking-level status as the aggregate/rollup view. Verify with a multi-passenger booking: set different per-passenger statuses, raise a refund against only one passenger."

---

### Step 15 — Per-service refund rule engine
**Audit ref:** §7.4 (CONFLICTING/MISSING), punch-list #3
**Depends on:** Step 2 (OTB figure fix) and ideally Step 14 (passenger-level refunds)
**Prompt to use:**
> "Build a per-service refund rule layer on top of the existing generic `computeRefundAmount` calculator. Re-read the refund rules table in `client-message/AUDIT_REPORT.md` §7.4 and the underlying service MDs, then implement, per service type: New Visa (full refund minus gateway within 4h of payment; ₹250 flat after doc validation; hard no-refund block once embassy-submitted), Visa Extension (distinguish 'Not Accepted' [refund minus gateway] from 'Rejected' [no refund] as two different terminal outcomes — this needs a schema addition since RefundStatus can't currently represent the distinction), Return Ticket (hard no-refund block once documents are forwarded to the vendor — no partial tier at all), OTB (₹250 after validation, hard block after airline processing), Flight Special Fare (paid minus vendor/gateway charges — already compatible, just confirm). Surface which rule applied and why in the refund calculator UI so staff aren't confused when a refund is blocked or reduced. Verify each service's rule with a targeted test case, especially the two hard-block cases (Return Ticket post-forwarding, New Visa post-embassy-submission)."

---

### Step 16 — Ticket OCR and Visa OCR
**Audit ref:** §3.6 (MISSING)
**Prompt to use:**
> "Extend the existing OCR pipeline (currently passport-only, see `src/lib/ocr/`) to also handle Ticket documents (extract Airline, Flight Number, PNR, Passenger, Departure/Arrival Airport+DateTime, Ticket Number, Baggage per CRM.md §17) and Visa PDF documents (Passenger, Passport Number, Visa Number, Visa Type, Issue/Expiry Date, Validity per CRM.md §18). Follow the exact same architecture as the passport OCR: a swappable provider, a staff review-and-confirm gate before anything writes to a real record, never-auto-save. Add a new `extractionType` discriminator to `PassportExtraction` (or split into a more general `DocumentExtraction` model) rather than bolting this onto the passport-specific model. Verify with the placeholder/dev provider against sample ticket and visa documents."

---


## Phase 4 — Operational Backbone (Task Engine, Communications, Status Engine)

These are large, foundational modules described in exhaustive detail across every service MD and CRM.md. Build them in this order since Communications and the status engine both benefit from the Task Engine existing first.

### Step 17 — Task Engine
**Audit ref:** §3.8 (MISSING), punch-list #9
**Prompt to use:**
> "Build the CRM Task Engine: a new `Task` model (type, priority, assignee, due date, status, linked entity) plus a staff-facing task list/inbox screen. Re-read the per-service MDs for the exact auto-generation triggers already documented per service (New_Visa.md §12 has the fullest example list: missing docs, OCR mismatch, passport <6 months validity, Protection Plan eligibility review, embassy resubmission needed). Wire auto-task-creation into the existing trigger points that already exist for other purposes (document flagged MISSING, OCR extraction pending review, quote about to expire) rather than duplicating that detection logic. Keep task creation additive — it should not replace or change any existing status/audit behavior. Verify: a flagged-missing document creates a task, a staff member can view/complete it."

---

### Step 18 — Communications module
**Audit ref:** §3.7 (MISSING), punch-list #9
**Depends on:** WhatsApp bot (already built, Phase 5C) and email sending (already built, Phase 5B) for the underlying transcript/log data.
**Prompt to use:**
> "Build the CRM Communications module per CRM.md §25: a staff-facing screen (per-lead or per-customer) showing a unified timeline of WhatsApp messages (from the existing `WhatsAppMessageLog`) and emails sent (from the existing AuditTrail EMAIL_SENT entries), with tabs or filters by channel. Add manual send capability for staff (compose and send a WhatsApp session message or email directly from this screen, respecting the same 24-hour WhatsApp session window rule already implemented in `src/lib/whatsapp/gateway.ts`). Do not build the 10-type AI-drafting feature in this step — that's a separate follow-up once the base module works. Verify staff can view a real conversation history and send a manual message."

---

### Step 19 — Per-service status engines + customer-safe status mapping
**Audit ref:** §3.9, §7.3 (CONFLICTING — deep architectural change), punch-list #10
**This is the largest single migration in this roadmap. Do not rush it.**

**Prompt to use:**
> "This is a deliberate architecture migration, not a small patch — re-read `client-message/CRM.md` §14 and every per-service MD's status list before starting, and propose a schema design before writing migration code. Replace the single shared `LeadStatus`/`BookingStatus` enums with a per-service-configurable status model: an Admin-managed `ServiceStatus` table (service type, status name, display order, is-terminal flag) plus a `ServiceStatusTransition` table (from-status, to-status) replacing the current hard-coded transition maps in `src/lib/leads/transitions.ts`/`src/lib/bookings/transitions.ts`. Add a second layer for the customer-safe mapping: each internal status maps to a simpler customer-facing label (e.g. internal 'Applied to Embassy' → customer 'Application submitted for processing') — build this as an Admin-editable mapping table, not hard-coded strings. This will touch the Lead/Booking detail pages, status controls, the Track Status page (once it's wired to real data), and the Admin masters section (new screen to configure statuses per service). Plan for a data migration of existing Lead/Booking rows into the new status shape. Do this as multiple smaller reviewed units, not one giant commit — propose the breakdown before starting."

---

## Phase 5 — Priced/Revenue Features and Cross-Service Rules

### Step 20 — Protection Plan
**Audit ref:** §7.1 (MISSING entirely), punch-list #8
**Prompt to use:**
> "Implement the Protection Plan feature per `client-message/New_Visa.md` §8-9: a new `ProtectionPlan` model linked per-passenger, with an Admin-configurable default price (seed at ₹5,000, editable via a new Admin settings field similar to `TaxFeeConfig`), mandatory T&C acceptance captured and stored at purchase time, an eligibility check, and the 14-status lifecycle described in the spec (re-read the exact list before implementing — don't invent status names). Add it as an optional add-on step in the New Visa request flow (both the customer form and the CRM quote builder need to reflect it). Verify: a passenger can opt in, the price is admin-configurable, and the status lifecycle transitions correctly."

---

### Step 21 — Document retention/reuse rules (3-month window)
**Audit ref:** §7.5 (MISSING)
**Prompt to use:**
> "Implement the document age-based reuse/retention rules from New_Visa.md §17-18/§27 and Visa_Extension.md §15-16: (1) when a returning customer starts a new request, check their existing documents' `createdAt` — if ≤3 months old, offer reuse with a confirmation prompt; if >3 months old, require a fresh upload. (2) Add a new n8n automation workflow (`/api/automation/document-retention`, following the existing pattern in `src/lib/automation/`) that runs periodically and purges documents older than 3 months past processing completion, EXCEPT Passport Front and Visa PDF which are retained. Log every purge action to AuditTrail before deleting. Verify the reuse-prompt logic and dry-run the purge job against test data before ever running it against real documents."

---

### Step 22 — Wire coupons into the real pricing formula
**Audit ref:** §3.2, §4.2, §7.8 (MISSING)
**Prompt to use:**
> "Wire the existing `Coupon` master into the actual quote/payment pricing path, which currently ignores it entirely. Implement CRM.md §10's locked formula: `Configured Service Amount + Additional Amount + Fine − Coupon + Gateway Charge = Customer Payable`. Add a coupon-code field to the quote builder, validate it server-side (active, within date range, under usage limit), apply the discount, and increment `Coupon.usageCount` on successful payment (not on quote creation, since a quote can expire unused). Also add the locked ₹500 employee-coupon cap as a new field/type distinction per ADMIN.md §25 (Employee/External/Abandoned-Quotation coupon types) if that distinction doesn't exist yet. Verify: applying a coupon reduces the payable amount correctly, usage count increments only after real payment, and the cap is enforced for employee-type coupons."

---

### Step 23 — Paid-booking config snapshots (document checklist)
**Audit ref:** §7.6 (PARTIALLY BUILT — pricing already snapshots by accident, documents don't)
**Prompt to use:**
> "The audit found pricing/tax figures already behave like snapshots (stored once, not live-recalculated) but document checklists don't — an Admin editing a nationality's DocumentRequirement list today can retroactively change what an already-paid booking requires. Add an explicit `documentChecklistSnapshot` JSON field to `Booking`, written once at booking creation from the then-current `DocumentRequirement` rows for that nationality/service, and have the booking detail page read from the snapshot rather than live-querying `DocumentRequirement` for any booking that has one. New (unpaid) leads should keep reading live config as today. Verify by editing a document requirement after a booking exists and confirming the existing booking's checklist doesn't change while a brand-new lead's does."

---

## Phase 6 — Admin Productivity Tools (lower urgency — internal tools, not correctness/compliance risks)

### Step 24 — Global Search
**Audit ref:** §4.6 (MISSING)
**Prompt to use:**
> "Build a cross-entity search feature per ADMIN.md §9 — a search bar in the CRM/Admin topbar that queries across Lead reference, Booking ID, customer name/mobile, and returns a unified result list linking to the right detail page for each match type. Start narrow (these four entity types) rather than trying to cover every field in the spec at once; this can be extended later. Verify with searches that should hit each entity type."

---

### Step 25 — Live Platform Monitoring
**Audit ref:** §4.5 (PARTIALLY BUILT — only n8n job monitoring exists)
**Prompt to use:**
> "Extend the existing `/admin/automation` monitoring page into a broader integrations health dashboard per ADMIN.md §11/§36: add connection-health indicators (configured vs. not, last successful call, last error) for Payment Gateway (Razorpay), Email (Resend), WhatsApp Cloud API, and OCR (Anthropic), reusing the existing `isPlaceholder()` env-var pattern to detect configured-vs-mock state per integration. Don't build live visitor tracking in this step — scope it to integration/provider health only, which is the highest-value narrow slice. Verify each integration's status reflects reality (test with and without real credentials configured)."

---

### Step 26 — PAX-based workload, roster, and auto-assignment
**Audit ref:** §3.11, §4.7 (MISSING), punch-list #11
**Prompt to use:**
> "Implement the locked workload rule from ADMIN.md §13: staff assignment should prefer whoever has fewer total PAX across open bookings, not fewer bookings. Build: (1) a PAX-counting helper that sums passengers across each staff member's currently-open (non-terminal-status) bookings; (2) an auto-assign option on lead creation/assignment that uses this to suggest (or, if the client wants full automation, directly assign) the least-loaded staff member; (3) a basic roster/leave model (`StaffLeave`: user, start date, end date) so leave-affected staff are excluded from auto-assignment suggestions; (4) an Admin bulk-reassignment screen (select a staff member → see all their open bookings → reassign some/all to someone else). Build these as separate reviewed units if the scope feels large — propose a breakdown first. Verify the PAX-counting logic with a multi-passenger test scenario."

---

### Step 27 — Admin AI Command Center
**Audit ref:** §4.4 (MISSING)
**Prompt to use:**
> "Build a natural-language admin command console per ADMIN.md §10/§41: a chat-style input where an Admin can ask questions ('why is booking X stuck', 'show failed automations today') or request actions ('disable OTB for Emirates'). Use the same Claude-provider pattern already established for the WhatsApp bot (`src/lib/whatsapp-bot/ai-provider.ts`) for the language understanding, but build a distinct execution layer with its own permission-check → validate → risk-assess → confirm → execute → audit pipeline — do not let it directly execute mutations without an explicit confirm step, and do not reuse the WhatsApp bot's customer-facing flow engine as-is (different risk profile). Start with read-only/reporting queries only in this step (no mutating actions) — that's a safer, still-valuable first slice; add confirmed mutating actions as a later step once the read-only version is trusted. Verify with several of the example queries from ADMIN.md §41."

---

### Step 28 — Expense Management / P&L Reporting
**Audit ref:** §4.8 (MISSING), punch-list #13
**Prompt to use:**
> "Build Expense Management per ADMIN.md §28-29: a new `Expense` model (category, amount, date, note, recorded-by), with the 15 named starter categories from the spec seeded as Admin-configurable options (Advertising, Salary, Domain, VPS/Hosting, AI, API, WhatsApp, Email, Software, OCR, Payment Gateway, Vendor, Office, Marketing, Operations, Other). Build a simple P&L report screen aggregating: total revenue (sum of successful Payments), total vendor cost (sum of Quotation.vendorCost for booked quotations), total margin, total expenses by category, net P&L for a selected date range. Keep this a reporting-only screen for this step, not a full accounting system. Verify the math against a small set of known test transactions."

---

## Phase 7 — Integration Refinements

### Step 29 — Wire real AI onto the website's Ask AI page
**Audit ref:** §2.8 (PARTIALLY BUILT / inconsistent with WhatsApp)
**Prompt to use:**
> "The website's `/ai` page currently always shows one canned reply, while the WhatsApp bot has a real Claude-powered FAQ-answering engine with a hallucination guard (`answerFaqOrHandoff` in `src/lib/whatsapp-bot/`). Wire the website's Ask AI page to reuse that same engine (via a new lightweight API route, not a duplicate implementation) so a customer gets a real, FAQ-grounded answer on the website too, with the same 'hand off to WhatsApp/staff if not found' behavior. Keep it clearly labeled as AI-assisted, and keep the no-live-booking-engine constraint from CLAUDE.md in mind — it should never claim to check live availability. Verify with both a matching and a non-matching question."

---








### Step 30 — WhatsApp menu-driven UX (client decision needed)
**Audit ref:** §6 (PARTIALLY BUILT / diverges from spec's stated UX shape)
**Action:** Not a coding step yet. The client's docs describe an admin-configurable button-menu WhatsApp experience (Visa/Flights/OTB/Return Ticket/Track Booking/Other); what's built is free-form AI intent detection instead. Both are legitimate, but ask the client directly: *"Do you want the WhatsApp bot to show a button menu of services, or is the current free-form 'just type what you need' AI approach acceptable?"* If they want the menu, that's a moderate follow-up prompt to add an Admin-configurable menu layer in front of the existing intent engine (menu button tap = pre-fills the same intent the AI would have detected) — don't rebuild the underlying engine.

---

## Phase 8 — Deployment & Process Governance

### Step 31 — Source and confirm the Git/staging/backup governance requirements
**Audit ref:** §8 — this could not be fully sourced from the two main governing docs this round.
**Action:** Not a coding step. Re-read `client-message/message.txt` and `client-message/Full Stack Developer for visa Platfrom.pdf` for the client's formal 7-point deployment requirements (Git branch workflow, staging environment, deployment docs, tracked migrations, tested/restorable backups, client-retained infra ownership, 30-day bug support — these were captured earlier in this engagement's conversation history). Confirm they're still accurate, then turn them into an actual deployment checklist/runbook once the app is closer to feature-complete. Don't build deployment infrastructure prematurely — this is a late-stage step, sequenced last deliberately.

---

## Phase 9 — Client Handover Updates (2026-09-20 handover docs)

**Source:** `client-message/HANDOVER_UPDATES_AUDIT.md`. Built one task at a time, in the order the client-side owner assigns them.
**Status key:** ⬜ not started · 🟦 in progress · ✅ done

| # | Task | Status |
|---|------|--------|
| H1 | Visa Extension: multi-applicant + per-applicant passport copy uploaded before Lead submission (per-applicant eligibility check, applicant-wise storage) | ✅ |
| H2 | Visa Extension: staff-facing panel showing the matched prior TripNexio visa for each applicant on the Lead detail page | ✅ |
| H3 | Visa Change: applicant-wise document upload before Lead submission | ✅ |
| H4 | New Visa: per-traveller array (Occupation, passport, DOB), minor/guardian rule | ⬜ |
| H5 | OTB: multi-applicant + travel-date/Urgent gating | ⬜ |
| H6a | Return Ticket: Admin-managed destination countries with per-applicant rate + 30/60/90 validity, passport number, multi-applicant, indicative price | ✅ |
| H6b | Special Fare: searchable airport dropdowns from the Admin airport database (+ CSV bulk import); multiple itineraries per lead | ✅ |
| H6c | Visa Change: 2-3 itinerary options per lead (different flight timings) | ✅ |
| H6d | Status lists: CRM statuses stay as seeded; the client's shorter lists are seeded as customer-facing labels (`ServiceStatus.customerLabel`) | ✅ |

**Client answers (2026-09-21):** Return Ticket is no longer UAE-only (all Middle East, Admin adds/removes countries and rates). Special Fare scope is Admin-controlled (GCC/India irrelevant), airports Admin-addable, needs multiple itineraries. CRM statuses = the old seeded ones. Visa Change needs 2-3 itineraries. CRM/Admin docs still to come from the client.

**H6b notes:** Departure/Arrival on the Special Fare form are now searchable comboboxes over `GET /api/airports` (public, active airports; matches city/name/code/country). Free text is still accepted so the form works while the list is being filled. Admin → Airports gained a CSV bulk import (`name,code,city,country`; upsert by code; country must already exist under Admin → Countries). No real airport list was seeded or invented — the client supplies the file (e.g. an IATA/OpenFlights export). Multiple itineraries: a lead can already carry several simultaneous flight quotes (verified 3 at once); selecting one expires the rest.

**H3 notes:** The Documents step of the Visa Change form now requires a passport copy per applicant (primary + each additional passenger); the API route re-checks this server-side (400 with per-applicant field errors) and attaches each image to its own Passenger as a PASSPORT Document (OCR review as before). This supersedes Visa_Change.md §20's upload-after-payment for the passport copy only. To support "every applicant must upload" without blocking the earlier identity step, `MultiStepRequestFlow` gained an optional `extraStepValidation` prop.

**H6c notes:** Visa Change quotes can now be itinerary options: the quote form gets an optional Itinerary block (airline, flight number, route, departure/arrival, baggage) and a Flight Ticket price that is added to the visa fee + charges (`Quotation.flightTicketPrice`, ignored for every other service). Staff adds one quote per itinerary option; they stay active side by side, and selecting the one the customer picks expires the others. There is no customer portal yet, so the customer's choice is recorded by staff. Prices stay staff/Admin-entered.

**H6d notes:** Only statuses with a clear customer-facing counterpart got a `customerLabel` (34 of ~110); internal-only steps stay null. Admin can edit any mapping at /admin/service-statuses. New Visa "Submitted to Embassy" now says "Applied to Embassy" (handover) instead of CRM.md §14's older "Application submitted for processing". No customer page renders these labels yet (Track Status still uses sample data) — wiring it to real bookings is a separate step. Re-running the seed overwrites Admin edits to these rows (existing seed behaviour).

**H6a notes:** Destinations live in `ReturnTicketDestination` (one per Country, `/admin/return-ticket-destinations`). The seed adds one SAMPLE UAE row at a placeholder ₹100 — the client sets real rates. The form shows an indicative price only; the Lead/quotation flow is unchanged (staff confirm final pricing). The WhatsApp bot's Return Ticket flow is unchanged (UAE, 30/60 days).

**H1/H2 notes (handover doc is treated as authoritative over the older locked spec):** Website form collects Full Name, Passport Number, Visa Expiry Date and a passport copy per applicant (primary also Mobile + Email); max 5 additional applicants. DOB / "inside UAE" / Entry Date were removed from the website form. Eligibility no longer blocks the submission — the Lead is always created and the CRM lead page ("Previous TripNexio Visa Check") shows each applicant's passport-number match against prior converted New Visa leads (with booking id and captured visa details), or "no match — follow the configured eligibility and rejection process". The existing staff Eligibility panel (verified expiry date/outcome) is unchanged. The WhatsApp bot keeps its own DOB/entry-date eligibility gate (`visaExtensionBotFieldSchemas`), untouched. Only a passport copy is collected as a document (the real required-document list is Admin-configured).

---

## Summary: Suggested Execution Order

1. Steps 1-4 (critical fixes) — do immediately, small and urgent.
2. Step 5 (Lead-ID architecture) — needs a quick client confirmation, then build.
3. Step 6 (service/country configurability) — client conversation only, no build yet.
4. Steps 7-10 (missing frontends) — high visibility, backend already exists, straightforward using the proven pattern.
5. Steps 11-16 (CRM core gaps) — build in listed order; Step 15 depends on Step 2.
6. Steps 17-19 (Task Engine, Communications, Status Engine) — largest architectural work, sequence deliberately, break into sub-steps as needed.
7. Steps 20-23 (revenue features & cross-service rules) — build once the status-engine migration (Step 19) has settled, since several of these interact with status.
8. Steps 24-28 (Admin productivity tools) — lower urgency, build when the above is stable.
9. Steps 29-30 (integration refinements) — Step 30 needs a client decision first.
10. Step 31 (deployment governance) — last, once feature work is substantially done.

At each step, follow `CLAUDE.md`'s existing hard rules: no invented domain data, work incrementally, migrations via Prisma and committed to git, commit after each working unit, and give numbered next steps at the end of every response.
