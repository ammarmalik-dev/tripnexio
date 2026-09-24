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








### Step 30 — WhatsApp menu-driven UX ✅
**Audit ref:** §6 (PARTIALLY BUILT / diverges from spec's stated UX shape)
**Status:** Client chose the button-menu option. Built as a real, tappable WhatsApp interactive list (Meta Cloud API session message, `WhatsAppGateway.sendInteractiveList`) shown on every greeting: the 6 services (Visa/Flights/OTB/Return Ticket + New Visa + Visa Extension — pulled live from the same Admin-managed `Service` rows the website's ServicesGrid uses, via `src/lib/whatsapp-bot/menu.ts`, so it's genuinely Admin-configurable without a second place to edit it) plus **Track my request** and **Talk to our team**. Tapping a row is handled in `engine.ts` *before* any AI call and maps deterministically to the exact same `startCollecting()`/handoff paths free text already used — the underlying engine wasn't rebuilt. Free-text natural-language input (English or Hinglish) still works exactly as before at every state; the menu only adds an option, never a gate. `ConsoleWhatsAppGateway` logs the rendered menu so this is fully exercised without real Meta credentials. Verified: menu shown on first contact and on "menu"/"restart", a tap starts the right service flow, Track/Agent taps handled, inbound message log shows the row's readable title (not its raw id), and free-text classification (including the Hinglish example) is unaffected.

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
| H4 | New Visa: per-traveller array (Occupation, passport, DOB, passport copy), minor/guardian rule, Admin-managed occupations | ✅ |
| H5 | OTB: multi-applicant + travel-date/Urgent gating (24 working days, Admin-configurable, per-airline override) | ✅ |
| H10 | Customer login/register: real sessions, guest-account claiming, My Account (requests/bookings) page | ✅ |
| H9 | CRM: "Copy Payment Link" button on Booking detail (shares the customer's /pay/<token> for any booking) | ✅ |
| H8 | New Visa / Visa Extension / Visa Change / Flight Special Fare: customer-facing quote review + approve + pay page | ✅ |
| H7 | Return Ticket + OTB: pay right after the form (guest /pay/<token> page), then upload documents after payment | ✅ |
| H6a | Return Ticket: Admin-managed destination countries with per-applicant rate + 30/60/90 validity, passport number, multi-applicant, indicative price | ✅ |
| H6b | Special Fare: searchable airport dropdowns from the Admin airport database (+ CSV bulk import); multiple itineraries per lead | ✅ |
| H6c | Visa Change: 2-3 itinerary options per lead (different flight timings) | ✅ |
| H6d | Status lists: CRM statuses stay as seeded; the client's shorter lists are seeded as customer-facing labels (`ServiceStatus.customerLabel`) | ✅ |

**Client answers (2026-09-21):** Return Ticket is no longer UAE-only (all Middle East, Admin adds/removes countries and rates). Special Fare scope is Admin-controlled (GCC/India irrelevant), airports Admin-addable, needs multiple itineraries. CRM statuses = the old seeded ones. Visa Change needs 2-3 itineraries. CRM/Admin docs still to come from the client.

**H6b notes:** Departure/Arrival on the Special Fare form are now searchable comboboxes over `GET /api/airports` (public, active airports; matches city/name/code/country). Free text is still accepted so the form works while the list is being filled. Admin → Airports gained a CSV bulk import (`name,code,city,country`; upsert by code; country must already exist under Admin → Countries). No real airport list was seeded or invented — the client supplies the file (e.g. an IATA/OpenFlights export). Multiple itineraries: a lead can already carry several simultaneous flight quotes (verified 3 at once); selecting one expires the rest.

**H10 notes:** `Customer.passwordHash` (nullable) added — a guest's Customer row (created by any lead-intake route) has none until they later register with the same mobile/email, at which point registration claims that existing row (same convention `findOrCreateCustomer` already used) instead of creating a duplicate, so their prior request history appears immediately on `/account`. `src/lib/auth/customer-session.ts`/`get-customer-session.ts` mirror the staff session pattern exactly (jose JWT, httpOnly cookie) but with their own `CUSTOMER_SESSION_SECRET`/cookie/30-day TTL — a fully separate system from staff auth, per CLAUDE.md's Auth section. `/account` (Server Component, redirects to `/login` if signed out) lists the customer's own Leads and Bookings with customer-friendly status wording (`src/lib/account/labels.ts` — a small local map, not the separate granular `ServiceStatus.customerLabel` catalog). Google OAuth stays a placeholder (`GoogleButton` still toasts "not connected") — building the real authorization-code flow now, with no `GOOGLE_CLIENT_ID`/`SECRET` from the client to test against, isn't worth doing until those exist. The Navbar wasn't changed — the client-approved reference design deliberately has no login icon there; `/login`/`/register`/`/account` are reachable directly.

**H8 notes:** Every lead for these 4 services now gets a `customerToken` (New Visa, Visa Extension, Visa Change, Flight Special Fare — OTB/Return Ticket keep using their own Booking-level token from H7's auto-checkout instead). When staff create a quotation, `QUOTE_READY`'s email/WhatsApp now includes a `{{reviewLink}}` to `/quote/<token>`, where the customer sees the quote(s) — Special Fare's alternative routes or Visa Change's itinerary options included, side by side, minus internal fields (vendor cost, margin) — and approves one. Approving reuses the exact same select → book → create-payment pipeline the CRM already used for staff-driven bookings (refactored into `selectQuotation()` / `createBookingFromQuotation()` so both paths share one implementation), then sends the customer straight to the existing `/pay/<token>` page from H7. As a side effect every Booking now gets a `customerToken` regardless of how it was created, so staff can also grab a shareable payment link for any booking from the CRM (no new UI for that yet — the token exists, just not surfaced there). These four services define no post-payment document checklist (unlike Return Ticket/OTB), so the payment page's document section stays empty for them — their existing pre-lead / staff-side document flows are unchanged.

**H7 notes:** After the Return Ticket / OTB form the customer lands on `/pay/<token>` (unguessable `Booking.customerToken`, no login). The price comes straight from Admin config, so the API auto-creates a selected Quotation (internal "Direct (auto-priced)" vendor, cost 0 — staff can edit), a Booking and a payment link (`createAutoCheckout`; payment creation is now the shared `createPendingPayment()`). Until real Razorpay keys are set the mock gateway is active and the page shows a clearly-labelled **demo** "Pay" button (`/api/pay/<token>/mock-pay` refuses once a real gateway is configured); with real keys the customer is sent to Razorpay and the page waits for the signed webhook. After payment: real Booking ID, receipt/invoice email, and per-applicant upload of the handover's document lists (Return Ticket: Passport, Visa copy, Onward ticket; OTB: those + Return ticket) — JPEG/PNG/GIF/WebP/PDF up to 3MB. If the automatic checkout fails the Lead is still saved and staff can send a link from the CRM. The other four services keep quote → approve → pay (a customer-facing quote-approval page is not built yet). File storage: local disk when writable, otherwise the database (`FileBlob`, served by `/api/files/<id>`) — Vercel has no writable disk; connect S3/Cloudinary before real production volume.

**H5 notes (client answers 2026-09-21):** Standard OTB processing = 24 working days (Mon-Fri; no holiday calendar), editable at Admin → OTB Timelines, with optional per-airline overrides on Admin → Airlines. A travel date inside the standard time offers/forces Urgent when the airline has an urgent price, otherwise the request is stopped with an explanation (enforced on the API too). The urgent-days minimum is left unset because the client hasn't given a number — until they do, urgent is accepted for any future date. The form now uses the real Admin airlines (active + OTB-required), adds passport numbers and additional applicants (name + passport only), shows an indicative price, and asks "Do you have a return ticket?" — "No" still submits and flags the Lead `returnTicketNeeded` for staff to offer the Return Verified Ticket. Not built: the handover's "Destination Country" field for OTB (OTB pricing is per airline), and per-applicant Adult/Child OTB rates.

**Bug fixed along the way:** zod 4's `.partial()` keeps `.default()` values, so any partial admin PATCH silently reset omitted fields (e.g. editing an airline's name reset `otbRequired` to false; disabling a record reset `displayOrder`). All update schemas now go through `partialUpdateSchema()` (`src/lib/validation/partial-update.ts`). Any admin data edited before this fix may have had such fields reset — worth a quick review of the Airlines/Airports/Borders screens.

**H4 notes (client answers 2026-09-21):** Under 18 = minor; the form shows "Apply with Parent/Guardian." and requires guardian full name, guardian passport number and relationship (Father / Mother / Legal guardian — the client said "link with one of parent"; Legal guardian is my addition, remove it if only parents are allowed). Occupation is a dropdown from Admin → Occupations (seeded Employee, Business, Retired, Student, Housewife, None; Admin adds/removes). Each traveller needs passport number, DOB, occupation and a passport copy before the Lead is created (server re-checks). The traveller count field was removed — it's derived from the travellers. Passenger type follows the Special Fare age rule (adult 12+, child 2-11, infant <2), which the client hasn't specified for New Visa. The WhatsApp bot's New Visa flow is unchanged.

**H3 notes:** The Documents step of the Visa Change form now requires a passport copy per applicant (primary + each additional passenger); the API route re-checks this server-side (400 with per-applicant field errors) and attaches each image to its own Passenger as a PASSPORT Document (OCR review as before). This supersedes Visa_Change.md §20's upload-after-payment for the passport copy only. To support "every applicant must upload" without blocking the earlier identity step, `MultiStepRequestFlow` gained an optional `extraStepValidation` prop.

**H6c notes:** Visa Change quotes can now be itinerary options: the quote form gets an optional Itinerary block (airline, flight number, route, departure/arrival, baggage) and a Flight Ticket price that is added to the visa fee + charges (`Quotation.flightTicketPrice`, ignored for every other service). Staff adds one quote per itinerary option; they stay active side by side, and selecting the one the customer picks expires the others. There is no customer portal yet, so the customer's choice is recorded by staff. Prices stay staff/Admin-entered.

**H6d notes:** Only statuses with a clear customer-facing counterpart got a `customerLabel` (34 of ~110); internal-only steps stay null. Admin can edit any mapping at /admin/service-statuses. New Visa "Submitted to Embassy" now says "Applied to Embassy" (handover) instead of CRM.md §14's older "Application submitted for processing". No customer page renders these labels yet (Track Status still uses sample data) — wiring it to real bookings is a separate step. Re-running the seed overwrites Admin edits to these rows (existing seed behaviour).

**H6a notes:** Destinations live in `ReturnTicketDestination` (one per Country, `/admin/return-ticket-destinations`). The seed adds one SAMPLE UAE row at a placeholder ₹100 — the client sets real rates. The form shows an indicative price only; the Lead/quotation flow is unchanged (staff confirm final pricing). The WhatsApp bot's Return Ticket flow is unchanged (UAE, 30/60 days).

**H1/H2 notes (handover doc is treated as authoritative over the older locked spec):** Website form collects Full Name, Passport Number, Visa Expiry Date and a passport copy per applicant (primary also Mobile + Email); max 5 additional applicants. DOB / "inside UAE" / Entry Date were removed from the website form. Eligibility no longer blocks the submission — the Lead is always created and the CRM lead page ("Previous TripNexio Visa Check") shows each applicant's passport-number match against prior converted New Visa leads (with booking id and captured visa details), or "no match — follow the configured eligibility and rejection process". The existing staff Eligibility panel (verified expiry date/outcome) is unchanged. The WhatsApp bot keeps its own DOB/entry-date eligibility gate (`visaExtensionBotFieldSchemas`), untouched. Only a passport copy is collected as a document (the real required-document list is Admin-configured).

---

---

## Phase 10 — Tier 1: Immediate service-flow fixes (2026-09-23 client answers)

**Source:** `client-message/ADMIN_CRM_CONSOLIDATION_AUDIT.md` Tier 1. Small, concrete, each already-confirmed by the client — build in this order, Step 35 depends on nothing else here but is the biggest of the four.

### Step 32 — OTB Urgent: support hour-level TAT (8 working hours), not just days ✅
**Audit ref:** Tier 1 #1
**Problem:** The client confirmed Urgent OTB processing is 8 *working hours*, and each airline can have its own TAT — `workingDaysUntil()`/`evaluateOtbTravelDate()` (`src/lib/otb/processing-rules.ts`) only reason in whole days, so a same-day or next-day request can't be correctly evaluated for Urgent eligibility.

**Prompt to use:**
> "OTB's Urgent processing timeline is confirmed at 8 working hours (client answer, 2026-09-23), and each airline can configure its own Standard/Urgent TAT, with Urgent suggested only when the *available time* (not just available days) falls within the configured TAT. Extend `src/lib/otb/processing-rules.ts`/`get-otb-rules.ts` to support an hour-level Urgent check alongside the existing day-level Standard check — define working hours (e.g. a fixed business-hours window, Mon-Fri) and compute hours-until-travel the same rigorous way `workingDaysUntil` computes days. Update `Airline.urgentProcessingDays`/`OtbRuleConfig.urgentProcessingDays` (or add hour-equivalent fields) and the Admin OTB Timelines / Airlines screens accordingly. Verify with a travel date a few hours away, a day away, and safely inside the standard window."

---

**Step 32 notes:** `Airline.urgentProcessingHours`/`OtbRuleConfig.urgentProcessingHours` (renamed from `...Days`, a genuine unit change, not a smaller day count — client confirmed 8 working *hours*). New `workingHoursUntil()` (`src/lib/otb/processing-rules.ts`) computes business hours (Mon-Fri, 9am-6pm — **assumption, business hours weren't specified anywhere, flag for client confirmation**) against **IST** specifically (not UTC, since the app otherwise computes in UTC but the actual business operates on India time — a fixed +5:30 offset, no timezone library needed since India has no DST). `evaluateOtbTravelDate()`'s signature changed to take `travelDate` directly (computes both the day and hour checks internally) rather than a pre-computed day count. Seeded default is now the confirmed 8 hours (previously left unset). A real boundary bug was caught and fixed before landing (comparing an IST-shifted cursor against an un-shifted target day both mis-counted the travel day itself as available hours) — verified against hand-traced examples (partial first day, full multi-day span, weekend skip, before/after business hours, same-day travel) before touching the API layer.

### Step 33 — New Visa: guardian relationship is Father/Mother only ✅
**Audit ref:** Tier 1 #2
**Problem:** `GUARDIAN_RELATIONSHIPS` in `src/lib/validation/new-visa-schema.ts` includes "Legal guardian" — the client has now confirmed only Father/Mother.

**Prompt to use:**
> "Per the client's confirmed answer (2026-09-23), remove 'Legal guardian' from `GUARDIAN_RELATIONSHIPS`/`GUARDIAN_RELATIONSHIP_LABELS` in `src/lib/validation/new-visa-schema.ts`, leaving only Father/Mother. Update the New Visa traveller form's relationship dropdown accordingly. Verify a minor traveller's guardian-relationship field only offers the two options."

---

**Step 33 notes:** `GUARDIAN_RELATIONSHIPS` now `["FATHER", "MOTHER"]` only. The form dropdown is generated from this array (not hardcoded), so no separate UI fix was needed. Verified server-side rejection of `"LEGAL_GUARDIAN"` (400) and acceptance of both remaining options with a real minor+guardian submission.

### Step 34 — Visa Extension & Visa Change: also require Visa Copy before Lead submission ✅
**Audit ref:** Tier 1 #3
**Problem:** H1/H3 only collect a Passport copy per applicant before Lead submission. The client has confirmed both Passport *and* Visa Copy are required before submission for these two services.

**Prompt to use:**
> "Per the client's confirmed answer (2026-09-23), both Visa Extension and Visa Change need a Visa Copy upload per applicant, in addition to the existing required Passport copy, before the Lead is created. Extend both services' schemas/forms/API routes the same way the passport-copy requirement was built (reuse `PassportUploadField`/`findMissingPassportImages`-style validation, or generalize it for a second document type). Attach each Visa Copy as its own `Document` (type `VISA_COPY`) linked to the correct Passenger, same as the passport upload. Verify server-side rejection when either document is missing, for both the primary and additional applicants."

---

**Step 34 notes:** `handleOptionalPassportUpload` gained an optional `documentType` param (defaults to `"PASSPORT"`, only runs passport OCR extraction for that type) so it could be reused for `VISA_COPY` without a second upload function. Visa Extension's schema requires both images directly (matching its existing required-field pattern); Visa Change's stay optional-in-schema, enforced via `findMissingApplicantDocuments` (renamed from `findMissingPassportImages`, now checks both document types) + `extraStepValidation`, matching its existing pattern. Verified server-side rejection when either document is missing, for both primary and additional applicants, on both services, and confirmed both documents land as separate `Document` rows (`PASSPORT`/`VISA_COPY`) on the correct Passenger.

### Step 35 — New Visa: pivot to pay-right-after-the-form with a real pricing config ✅
**Audit ref:** Tier 1 #4 (largest item in this phase)
**Problem:** The client's confirmed flow is *Basic form → Lead → Payment → Booking → Documents* — the same "pay right after the form" pattern as Return Ticket/OTB (H7), not New Visa's current quote-review-and-approve pattern (H8). This needs a real, Admin-managed New Visa pricing config (by country + visa type) to compute the price automatically — `PricingRule` exists but has never been wired to anything (flagged since Phase 4C).

**Prompt to use:**
> "Per the client's confirmed answer (2026-09-23), change New Visa's flow to match Return Ticket/OTB's pay-right-after-the-form pattern: after the traveller-details form, the customer goes straight to `/pay/<token>` (reuse `createAutoCheckout`/`createPendingPayment`), not the H8 quote-review page. Build a real New Visa pricing config — either extend `ReturnTicketDestination`'s pattern into a new `NewVisaDestination`-style model (country + visa type + rate, Admin-managed) or finally wire the existing `PricingRule` model (serviceType/paxType/nationality/basePrice/additionalCharges) into a price-computation function, whichever fits the client's actual country/visa-type/traveller-count pricing shape better — confirm which if unclear rather than guessing. Compute the total from the traveller count (adult/child/infant per `computePaxType`). After payment, keep the existing post-payment document flow (Return Ticket/OTB's document-upload pattern) — note New Visa already collects passport+guardian docs *before* the Lead in H4, so decide whether any further post-payment upload is actually needed or whether H4's pre-lead documents already satisfy this. Staff/Admin can still see and, if needed, override the auto-computed price from the CRM. Verify end-to-end with a real country+visa-type rate, and confirm the old H8 quote-review path for New Visa is fully replaced, not left dangling."

---

**Step 35 notes:** Re-read `client-message/New_Visa.md`'s original locked flow (§3/§5) before designing this — it confirms a "Final quotation" step already existed before payment in the ORIGINAL spec (now auto-computed rather than staff-prepared) and that "Document upload" is a real, separate post-payment step (§5 step 16), distinct from H4's pre-lead passport+guardian documents — so both were kept, not treated as redundant.

Built a new `NewVisaPricing` model (country + Normal/Express, separate Adult/Child/Infant rates — matches the locked rule "Adult/Child pricing is separate," §6/§8) rather than forcing the existing unused `PricingRule` model to fit — `PricingRule`'s only dimensions are paxType/nationality, with no country or processing-type axis, so it genuinely didn't match New Visa's actual pricing shape (same reasoning that led to `ReturnTicketDestination` being its own model instead of `PricingRule` earlier). `visaType` (the sample tourist/business/etc. categories) is deliberately **not** a pricing dimension — those are still illustrative sample data, and pricing against an invented category would be worse than not pricing by it.

`createLeadFromSubmission` no longer generates a `Lead.customerToken` for `NEW_VISA` (removed from `QUOTE_REVIEW_SERVICES`) — the old H8 quote-review path is fully retired for new New Visa leads (old already-created tokens/quotations from before this change still work, nothing deleted). `createAutoCheckout` widened to accept `NEW_VISA` and now also offers Protection Plan to every passenger (it didn't before — only the staff-driven `createBookingFromQuotation` path did), so New Visa keeps that behavior after the pivot. A missing pricing rule (unconfigured country/processing-type combo) never loses the Lead — it's still created, just without a payment link, so staff can follow up manually; verified this explicitly, not just assumed.

Post-payment documents: rather than hardcode a document list the client never gave (unlike Return Ticket/OTB, whose lists came verbatim from their own handover docs), New Visa's `/pay/<token>` checklist is read **dynamically** from the existing Admin-managed `DocumentRequirement` table (nationality defaulted to "India" — New Visa's form never asks nationality, and the whole market scope is India-sourced, matching how OTB already never asks it either). With only a `"Sample Nationality"` row seeded today, this correctly shows an empty checklist rather than a fabricated one.

Verified end-to-end: a 2-traveller (adult+child) submission against a real seeded UAE/Normal rate correctly auto-created a Quotation+Booking+payment link, paid successfully, assigned a real `TNX-NV-...` booking id, and offered Protection Plan to both passengers; an unconfigured country (Oman) and an unconfigured processing type (urgent) both still created the Lead with no payment link; a new Admin-added Oman/Express rate was picked up by the very next matching request with no redeploy; editing that rate's price took effect immediately on the next request.

## Phase 11 —## Phase 11 — Tier 2: Shared masters & Admin panel consolidation (`Admin FINAL Developer Handover`)

**Source:** `client-message/ADMIN_CRM_CONSOLIDATION_AUDIT.md` Tier 2. The document's own core rule: *"Do not create duplicate master data or separate configuration screens where one common control can serve multiple services."* Build roughly in this order — masters/foundations first, since several later steps (Pricing/Documents/Timeline controls, New Visa Country Configuration) depend on them.

### Step 36 — Extend the Vendor model (POC, GST/payment details, multi-service) ✅
**Audit ref:** Tier 2 §12
**Problem:** `Vendor` is currently just `name/service/active` — one service per vendor, no contact/GST/payment fields, no per-service cost/performance tracking without duplicating vendor records.

**Prompt to use:**
> "Extend the `Vendor` model per the Admin FINAL handover §12: add POC name/mobile/email, GST/tax details, payment/account details, and change the service link from a single `ServiceType` to a many-relation (a vendor can support multiple services/sub-services) without creating duplicate Vendor rows per service. Update the Admin Vendors screen and `GET /api/vendors` (used by the quote builder) accordingly. Keep existing Quotation→Vendor references working. Verify a vendor can be created once and linked to 2+ services, and that vendor cost/rate stays trackable service-wise."

`Vendor.service ServiceType` was replaced by a new `VendorService` join table (`vendorId` + `service`, unique per pair) — migration hand-written (not `migrate dev`, same recurring shadow-DB workaround) with a data backfill: one `VendorService` row per existing Vendor from its old single `service` value, before the column was dropped, so no vendor lost its service link. `Vendor` gained `mobile`/`email`/`pocName`/`processingDetails`/`availability`/`gstNumber`/`paymentDetails`, all optional free-text (§12 doesn't specify a structured shape for "processing details"/"payment details"). **Vendor cost/rate stays trackable service-wise without a new field** — `Quotation.vendorCost` was already scoped to its Lead's `serviceType`, and that didn't change; a second per-service cost field on Vendor itself would've been a duplicate source of truth, not a fix.

Every read site updated: `GET /api/admin/vendors` (Admin CRUD, includes `services`), `GET /api/vendors?service=` (quote builder's lookup, now filters via `services: { some: { service } } }` and no longer returns a `service` field since a vendor can have several), and `createAutoCheckout`'s vendor-resolution (OTB/Return Ticket/New Visa's pay-right-after-form path) — this one was easy to miss since it doesn't live under `/admin/vendors` at all; caught it via `tsc` failing on the old `service:` field, not by inspection. `VendorsManager.tsx` rebuilt with a service-coverage checkbox list (same pattern as `RolesManager.tsx`'s permission checklist) alongside the new profile fields. Seed re-shaped: Sample Vendor A now covers **two** services (`NEW_VISA` + `VISA_EXTENSION`) specifically to demonstrate the new capability, using delete-then-recreate for the join rows so re-seeding always converges correctly (no upsert-on-a-relation ambiguity).

Verified end-to-end against a real dev DB: created a vendor linked to 2 services in one call; confirmed it appears in both services' `GET /api/vendors?service=` lookups and not a third, unrelated service's; empty `services` array rejected (400); `PATCH` narrowing a vendor from 2 services down to 1 confirmed both in the response and in a follow-up lookup; `active` toggle confirmed to leave service coverage untouched; a live New Visa lead submission confirmed `createAutoCheckout`'s vendor resolution still works against the new join-table shape end-to-end (real payToken issued).

---

### Step 37 — Wire the common Airline master into Return Ticket and Special Fare ✅
**Audit ref:** Tier 2 §9
**Problem:** `Airline` is only actually used by OTB today — Return Ticket and Special Fare's schemas have no Airline reference, contradicting the "one common airline list for all applicable services" rule.

**Prompt to use:**
> "Per Admin FINAL handover §9, wire the existing `Airline` master into Return Ticket and Special Fare wherever an airline is currently free text (e.g. Special Fare's quote-builder `airline` field, and anywhere Return Ticket captures a carrier). Reuse the same Admin-managed Airline list OTB already uses — do not create a second airline list. Verify both services' relevant forms/quote fields now pull from the shared master."

No schema/migration needed — `Quotation.airline` was already a plain string column (only Flight Special Fare used it, as free text with zero DB validation). Two real gaps closed instead:

1. **A shared active-airlines lookup didn't exist.** The only two Airline routes were the full Admin CRUD (`/api/admin/airlines`) and an OTB-specific one (`/api/otb/airlines` — public, filtered to `otbRequired: true`, no `id`, keyed by `code`). Reusing the OTB one would have wrongly excluded non-OTB-required airlines from Special Fare/Return Ticket's picker. New `GET /api/airlines` (staff-gated, mirrors `GET /api/vendors`) filters only on `active` and returns `{id, code, name}` — the genuinely shared list.
2. **Return Ticket had zero airline/carrier concept anywhere** (confirmed by re-reading its own request schema, form steps, and lead-creation route) — not a free-text field to convert, new ground. Checked `Return_Verified_Ticket.md` first: every "airline" mention there is "vendor/airline" as the backend fulfillment side (staff/vendor arranges the reservation) — the client's own locked spec never has the *customer* pick an airline for this service, matching how the customer never picks a vendor either. So the fix landed on the CRM/quotation side, not a new customer-facing form field: `QuoteBuilderForm.tsx` gained an optional Airline `<select>` in the simple-fee-quote branch, shown only for `RETURN_TICKET` (`showAirlineField` prop), writing to the same existing `Quotation.airline` column.

Both existing free-text "Airline" `TextField`s (Flight Special Fare's main block, Visa Change's itinerary block — `supportsItinerary`) were swapped for the same real `<select>`, sourced from `GET /api/airlines`. Server-side validation added to both `POST /api/quotations` and `PATCH /api/quotations/[id]` — a submitted `airline` code is now looked up against `db.airline` (active only) and rejected (400) if it doesn't match, the same never-trust-the-client pattern OTB's own lead-intake route already uses for its airline code. New `capturesAirline(serviceType)` helper in `pricing.ts` (true for Flight Special Fare, Visa Change, and now Return Ticket) drives whether `QuoteBuilder.tsx` even fetches the airline list. `QuoteCard.tsx` now shows the airline on a Return Ticket quote's card when one was set.

Verified end-to-end against a real dev DB: `/api/airlines` correctly includes a non-`otbRequired` sample airline (proving it isn't OTB-scoped) and 401s with no staff session; a real Return Ticket lead's quotation accepted a valid airline code, rejected an invalid one (400, field error), and succeeded fine with no airline at all (still optional); the same code-then-invalid-code pair confirmed on `PATCH`; a Flight Special Fare lead's quotation accepted a valid airline code and rejected an invalid one the same way.

---

### Step 38 — Staff Leave: approval workflow ✅
**Audit ref:** Tier 2 §2
**Problem:** `StaffLeave` currently has no `status`/approver/approval-date — leave requests can be recorded but never explicitly approved or rejected.

**Prompt to use:**
> "Add an approval workflow to `StaffLeave`: a `status` enum (PENDING/APPROVED/REJECTED), `approvedByUserId`, `approvedAt`, and a `type` (e.g. sick/casual/other, keep it simple unless the client specifies categories). Staff can apply for leave from the CRM; Admin can approve/reject, and can also directly create a leave entry for any staff member. Approved leave must continue to exclude that staff member from auto-assignment (already true for existing StaffLeave rows — keep that working, just gate it on APPROVED status now instead of any row's mere existence). Verify: a staff-created leave request starts PENDING and doesn't yet exclude them from assignment; approving it does."

`StaffLeave` gained `status` (`LeaveStatus`: PENDING/APPROVED/REJECTED), `type` (`LeaveType`: SICK/CASUAL/OTHER — the roadmap prompt's own suggested starter set, no category list was ever given by the client), `approvedByUserId`, `approvedAt`. Migration backfills every pre-existing row to APPROVED (not the new PENDING default) specifically to preserve their already-true exclusion behavior per this prompt's own instruction — `approvedByUserId`/`approvedAt` stay NULL for those grandfathered rows since there's no real record of who approved them or when (hard rule #1: don't fabricate that).

**Two creation paths, deliberately different starting states**: `POST /api/admin/staff-leave` (Admin recording a leave directly for any staff member, unchanged route, `staff.manage`-gated) now creates it straight into APPROVED with the admin as approver — an admin's own direct action IS the decision, no separate approve click needed. New `POST /api/staff-leave` (Step 38's actual new ground — **no staff-facing route or UI existed for this at all before**, confirmed by exploration) is session-gated only, any active staff member, always forces `userId` from the session (never trusts a client-sent one) and always starts PENDING.

**New permission `staff.leave.approve`**, deliberately separate from `staff.manage` — mirrors this exact codebase's existing `refunds.edit`/`refunds.approve` split (raise vs. approve) rather than reusing `staff.manage` for the decision too. Excluded from the default Staff role (Admin-only by default), same precedent as `refunds.approve`. New `PATCH /api/admin/staff-leave/[id]/status` (gated by it) is the approve/reject action, going through a new `src/lib/staff-leave/transitions.ts` (PENDING → APPROVED/REJECTED, both terminal — same transition-map pattern as Lead/Booking/Refund).

**New CRM surface**: `/crm/my-leave` (`MyLeavePanel.tsx`) — the first screen in CRM.md §3's previously-unbuilt "Profile" nav group. Lists the signed-in staff member's own leave requests with status, plus a request form. `eligible-for-assignment.ts`'s query gained `status: "APPROVED"` — the one and only reader of `StaffLeave` for assignment purposes (confirmed via full-codebase grep before touching it, so no other reader was missed).

Verified end-to-end against a real dev DB: confirmed the Staff role genuinely lacks `staff.leave.approve` by default; a freshly-created Staff-role test user requesting their own leave got PENDING; that same staff member attempting to approve their own request got 403; a spoofed `userId` in the request body was silently ignored (always their own session id); the admin list showed the pending request; **directly queried the exact `eligible-for-assignment.ts` where-clause before and after approval** — confirmed NOT excluded while PENDING, confirmed excluded once APPROVED (the prompt's own explicit verification ask); re-deciding an already-APPROVED request was rejected (409); and an admin-direct-created leave landed as APPROVED immediately with the admin recorded as approver. **One real dev-environment bug hit and fixed during testing, unrelated to the feature's own logic**: a nested dynamic route (`[id]/status/route.ts` alongside an existing `[id]/route.ts` — an already-proven pattern elsewhere, e.g. `bookings/[id]/status`) 404'd until a full `taskkill /IM node.exe` + `.next` wipe + restart — a stale Turbopack dev-server route-registration issue, not a code defect; recorded here in case it recurs.

---

### Step 39 — Service-wise staff permissions ✅
**Audit ref:** Tier 2 §1
**Problem:** Every RBAC permission today (`leads.view`, `leads.edit`, etc.) applies uniformly across all services — there's no way to grant a staff member access to OTB and Return Ticket leads but not Visa Change ones.

**Prompt to use:**
> "Add service-scoping to the existing RBAC system per Admin FINAL handover §1, inside the current Roles & Permissions module — do not build a second permission system. Design: either (a) a new join table scoping a Role's (or User's) existing permissions to a specific `ServiceType` set, or (b) a per-user `allowedServices: ServiceType[]` field checked alongside the existing permission check in `requirePermission()`/`getStaffSession()`. Pick whichever fits the existing permission-check call sites with the least disruption, and explain the choice. Every service-scoped CRM screen (Leads, Quotations, Bookings, Documents, etc.) must filter to the staff member's allowed services, and every relevant API route must 403 on a service outside their scope. Verify: a staff user granted only OTB+Return Ticket can act on those leads but gets 403/an empty filtered list for a Visa Change lead."

**Chose (b) — a per-user `User.allowedServiceTypes ServiceType[] @default([])` column, not a Role-level join table.** Rationale, per the prompt's own "explain the choice" ask: the prompt's own test case is per-individual ("a staff user granted only..."), and this codebase's permissions live on `Role` only (many users can share one) — conflating service-scope onto `Role` too would force a dedicated Role per distinct service combination even when permissions are otherwise identical, which is exactly the role-proliferation RBAC is supposed to avoid. A native array column (not a join table like Step 36's `VendorService` precedent) because it's a strictly smaller diff — one more column on the `db.user.findUnique(...)` query `getStaffSession()` already runs, no new model/migration/relation — and nothing in this app ever needs to query "which users are scoped to service X" in reverse, so a join table's usual advantage never actually applies here. Empty array (the default) means **unrestricted** — every existing user keeps full access with zero migration risk; `admin.full` always bypasses scoping too, mirroring `hasPermission()`'s own rule.

New `src/lib/auth/service-scope.ts` is the one shared layer every route uses: `assertServiceAccess()` (403 for a detail/mutation route once the resource's serviceType is resolved) and `serviceTypeCondition()` (a list route's `where`-builder condition — `{}` unrestricted, the exact requested type if in scope, or an always-empty `{in: []}` filter if the caller explicitly requested something outside their scope — a list route returns an empty result for that, never a 403; only a detail/mutation route errors). Applied across all 7 resource types the prompt named, both list AND detail/mutation routes (not just lists — an unscoped detail route would have been a real hole, since staff.view alone would still let a scoped-out user fetch a lead by id if they had it):

- **Leads**: list + every one of the 8 `[id]/*` sub-routes (status, assign, temperature, visa-extension-verify, visa-change-border-details, communications, communications/send), plus `admin/bulk-reassignment` (target-staff scope checked too — can't bulk-move work onto someone scoped out of it).
- **Quotations**: both list modes, POST, `[id]` PATCH, `[id]/select` — the latter two needed their own lead lookup first since `selectQuotation()`/`createBookingFromQuotation()` are shared with the *customer-facing* quote-approve flow (`/quote/[token]/approve`), which has no staff session at all — the scope check had to live in the staff route, not inside the shared helper.
- **Bookings**: list, POST, `[id]` GET + status/issue-reservation/extension-outcome/payments/passengers-status.
- **Payments**: list, mark-success, refunds (create), invoice.
- **Refunds**: list, status.
- **Documents**: list (both modes) + POST + status/upload/reuse/run-ocr. A document scoped to a Passenger only (no Booking) has no single derivable serviceType — a passenger can have leads across several services — so it's a documented, deliberate exception: never scope-restricted, shown to anyone with `documents.view` regardless of `allowedServiceTypes`. `DocumentExtraction`/`Passenger` routes weren't in the prompt's named list and share this same ambiguity, so left unscoped too.
- **Tasks**: list, status, assign. `Task.serviceType` is already nullable/denormalized (not every trigger can resolve one) — a null-serviceType task is never hidden by scoping, same reasoning as passenger-only documents.
- **Dashboard** (`/crm`'s landing page) — not named in the prompt's list, but left global would have been a real leak (a scoped user's own landing page showing out-of-scope volume/KPI numbers defeats the point of scoping). `getSalesOverview`/`getOperationsOverview`/`getActionQueue` all gained an optional `allowedServiceTypes` param threaded through every query.
- **Auto-assignment** — `getEligibleStaffForAssignment()` gained an optional `serviceType` param (excludes staff scoped out of it, same as inactive/on-leave); `GET /api/staff` gained an optional `?service=` filter mirroring `GET /api/vendors?service=`; `LeadAssignmentControl.tsx` now passes the lead's own serviceType to both the staff dropdown and the suggestion.
- **Admin UI**: `StaffUsersManager.tsx` gained a "Service Scope" column (checkbox grid, dirty-check-gated Save, same pattern as every other masters editable-card) and the same checklist on the New Staff Account form.

Verified end-to-end against a real dev DB with a genuinely fresh scoped staff account (OTB + RETURN_TICKET only) and real leads across all three services (including a real Visa Change lead with actual passport/visa image uploads, not a stub): the scoped staff member could view/quote their own OTB lead (200/201) but got exactly **403** fetching or mutating the Visa Change lead and **403** building a quote on it (the prompt's own literal test case); an unfiltered lead list never leaked the Visa Change lead, and explicitly requesting `serviceType=VISA_CHANGE` returned an empty list rather than erroring; an Admin attempting to assign the Visa Change lead onto this scoped staff member was rejected (400); `GET /api/staff?service=` correctly included/excluded the scoped staff member per service; the dashboard still loaded without error for a scoped session; and an unrestricted Admin saw everything throughout, confirming scoping never over-applies to `admin.full`.

---

### Step 40 — One central Pricing Control, wired into real pricing ✅
**Audit ref:** Tier 2 §4
**Problem:** Pricing is scattered (`PricingRule` exists but unused; New Visa's Step 35 needs it; OTB/Return Ticket have their own ad-hoc rate fields on `Airline`/`ReturnTicketDestination`). The client wants one control covering service/sub-service, country, nationality, adult/child/infant, normal/express, vendor cost, selling price, extra charges, and validity dates.

**Prompt to use:**
> "Build the one central Pricing Control the Admin FINAL handover §4 describes, using/extending the existing `PricingRule` model as the base (add country, normal/express, and validity-date fields if missing). This becomes the actual price-computation source for New Visa (Step 35) and any other auto-priced service, while `ReturnTicketDestination` and `Airline.normalPrice/urgentPrice` can either be migrated into this central model or left as-is if the client confirms per-service rate shapes genuinely differ too much to unify — don't force a bad-fit merge silently, flag it if so. Pricing changes must never alter an already-paid/confirmed booking's frozen price (existing quotations already snapshot `sellingPrice`/`margin` — confirm this still holds). Verify a price computed for a new request reflects the latest Admin-configured rule, while an already-booked one doesn't change when the rule is edited afterward."

Extended `PricingRule` with `countryId` (FK to `Country`, nullable), `processingType` (nullable string, "normal"/"urgent"), `vendorCost`, and `validityFrom`/`validityUntil` — plus renamed `basePrice` → `sellingPrice` (matching §4's own wording) via a hand-written `RENAME COLUMN`, not a drop+recreate, so the pre-existing sample rows kept their data. **`NewVisaPricing` (Step 35) is fully retired** — its 3 CRUD routes, Admin screen, nav entry, and validation schema deleted; the migration data-migrates every existing row into 3 `PricingRule` rows (one per paxType) before dropping the table. `computeNewVisaPrice()` now queries `PricingRule` directly and also returns a real `vendorCost` (summed across travellers) — `createAutoCheckout()` gained an optional `vendorCost` param so New Visa's auto-checkout can finally record a genuine margin instead of always defaulting to 0 (OTB/Return Ticket keep defaulting to 0, since neither `Airline` nor `ReturnTicketDestination` has a vendor-cost field to draw from).

**OTB and Return Ticket deliberately NOT unified — flagged, not silently forced**, per the prompt's own explicit permission: OTB's rate (`Airline.normalPrice`/`urgentPrice`) is keyed by *airline*, not country — its own locked spec has no country dimension in pricing at all, so folding it in would mean inventing a fake country per airline. Return Ticket's `ReturnTicketDestination.ratePerApplicant` stays a flat per-country rate — its own locked spec (`Return_Verified_Ticket.md` §11) actually *does* describe adult/child/infant pricing, but that was never built; migrating it into `PricingRule` today would mean fabricating child/infant prices that don't exist, which hard rule #1 forbids. Both documented directly in `PricingRule`'s own schema doc comment and the Admin Pricing page's copy, for the client to weigh in on.

**Frozen-price rule reconfirmed, not just assumed**: traced both quotation-creation paths before touching anything — `Quotation.sellingPrice`/`vendorCost`/`margin` are plain snapshotted columns with no FK back to any pricing table, matching `ADMIN.md` §19's own locked rule. Verified this explicitly end-to-end (see below), not just by code inspection.

**One real, currently-reproducing bug caught and fixed along the way**, unrelated to pricing logic itself: `SelectField.tsx` set `defaultValue=""` unconditionally, which React flags as an error when a caller also passes `value` (a controlled select) — reproduced live in the browser building this step's own Country dropdown. Fixed generically (only apply `defaultValue` when the caller isn't already controlling `value`) rather than working around it locally — this also silently fixes the same latent issue in `ReturnTicketDestinationsManager.tsx`'s Country select, which used the identical pattern.

**Seed data note**: `PricingRule` has no DB-level uniqueness (nullable-column semantics get messy in Postgres, same reasoning as this model's original doc comment), so a plain upsert-by-fixed-id can't detect a pre-existing row created by something else (the migration's own data-copy) under a different id. Fixed by having the seed find-or-create by the actual semantic key (service+country+processingType+paxType+nationality) instead — caught this exact duplication happening in the local dev DB during verification, cleaned it up, and confirmed a re-seed now converges without creating duplicates.

Verified end-to-end against a real dev DB: the old `/api/admin/new-visa-pricing` route confirmed gone (404); a real 2-traveller (adult+child) New Visa submission computed 8500 + 2% gateway fee correctly from the migrated/reseeded UAE/normal rule; **the frozen-price guarantee directly proven** — edited the Adult rule's `sellingPrice`/`vendorCost` after a quotation existed, re-fetched that same quotation, confirmed it was completely unchanged; a **new** submission immediately after that edit picked up the new live rate with the new vendorCost/margin; an exact-duplicate rule creation rejected (400); OTB confirmed unaffected (still uses its own `Airline` rates, still payable). Also visually confirmed in Chrome: the Admin Pricing screen renders all fields (service/country/processing type/pax type/nationality/vendor cost/selling price/additional charges/validity dates), the Enable/Disable toggle works live, and the console is clean (the `SelectField` bug above was caught this way, then re-verified fixed).

---

### Step 41 — One central Document Requirements control ✅
**Audit ref:** Tier 2 §5
**Problem:** `DocumentRequirement` (nationality+serviceType+documentName) is close to what's asked but needs confirming/extending for country and applicant-category rules, and a bulk-apply-to-multiple-services option.

**Prompt to use:**
> "Extend the Admin Document Requirements screen per Admin FINAL handover §5: confirm/add a country dimension (distinct from nationality if the client means something different by it — ask if ambiguous), support applicant-category rules (adult/child/infant, primary/additional), and add a bulk-apply action that copies a checklist from one service/country to others in one action. Verify New Visa's country setup (Step 43) can reference this same control, not a separate one."

**Country vs. nationality — confirmed genuinely ambiguous, resolved by reading the client's own docs rather than guessing**: extracted §5's literal text ("Admin selects service/sub-service/**country**") and cross-checked it against `ADMIN.md` §14/§22 (its own document-checklist dimensions list — "Country · Service · Sub-service · Visa type · Passenger type" — never mentions nationality at all) versus `Visa_Change.md` §11/§12 (built entirely around the applicant's own **nationality**, with no country filter for documents). These are two real, distinct concepts in the client's own material, not a naming collision — kept **both** as independent nullable dimensions on `DocumentRequirement` (`countryId` FK + `nationality` string), mirroring exactly how `PricingRule` (Step 40) already solved this same ambiguity for Pricing.

**Applicant-category rules → modeled as `PaxType` (nullable), not a separate primary/additional flag**: checked first — "primary vs. additional applicant" has zero precedent anywhere in this schema (not on `Passenger`, not on `BookingPassenger`, not on any of the four `additionalApplicants`/`additionalPassengers` request schemas across services) — while `PaxType` (ADULT/CHILD/INFANT) has full precedent (`Passenger.paxType`, `PricingRule.paxType`) and matches `New_Visa.md` §16's own worked example (adult/child sharing an identical checklist). Flagged this reasoning in the schema's own doc comment rather than silently picking one reading.

**Bulk apply**: new `POST /api/admin/document-requirements/bulk-apply` (+ a `GET` preview), following the exact same shape as Bulk Reassignment (Step 26) — pick one exact source combination (service/country/nationality/pax type), preview what it contains, copy it onto one or more target services in one transaction. A target service that already has an identical document (same country/nationality/paxType/documentName) is skipped for that one, never overwritten — confirmed idempotent by re-running the same bulk-apply twice and getting 0 copied the second time.

**Matching logic upgraded everywhere `DocumentRequirement` is actually read**, not just the Admin screen — `buildDocumentChecklistSnapshot()` (the frozen booking snapshot) and `getNewVisaCheckoutDocumentTypes()` (New Visa's real post-payment checklist) both now match on all three dimensions independently (a rule with a dimension left unset applies universally on that axis; a passenger with no nationality on file no longer gets an empty checklist outright — a country- or paxType-only rule can still apply to them, a genuine improvement over the old nationality-only match). **New Visa's destination country is now resolved and threaded through both paths** (from `Lead.details.destinationCountry`, the same field `computeNewVisaPrice` already reads) — directly answers the prompt's "verify New Visa's country setup can reference this same control." OTB/Return Ticket's own hardcoded checklists are unchanged (confirmed they never read this table at all, out of scope here). Dropped the old `@@unique([nationality, serviceType, documentName])` DB constraint — now-nullable columns make Postgres uniqueness messy — in favor of an app-level exact-match duplicate check, same pattern `PricingRule` already established.

Verified end-to-end against a real dev DB: a country+paxType-scoped rule created and confirmed NOT clashing with an identically-named rule for a different pax type (proving pax type is genuinely part of the identity); an exact duplicate correctly rejected; bulk-apply preview showed exactly the right source rows, copying onto Visa Extension preserved the country/paxType exactly, and a re-run correctly copied zero (idempotent); and — the concrete, real test — created a UAE-scoped `NEW_VISA` requirement via the Admin API, submitted a real New Visa lead for UAE, completed payment, and confirmed that exact requirement appeared in the live post-payment checklist on `/pay/<token>`.

---

### Step 42 — One central Timeline/SLA control ✅
**Audit ref:** Tier 2 §6
**Problem:** Only OTB has a real SLA config (`OtbRuleConfig`, extended in Step 32). Every other service has no configurable timeline for document verification, quotation response, or payment deadline.

**Prompt to use:**
> "Generalize `OtbRuleConfig`'s pattern (Step 32) into a shared Timeline/SLA control per Admin FINAL handover §6: normal/urgent processing time, document verification time, expected completion time, quotation response time, and payment deadline, configurable by service, and by country/sub-service/vendor/processing-type where the client actually needs that granularity (confirm rather than over-building every dimension speculatively). Wire these into existing reminder/escalation automation (the n8n jobs from Phase 5E) where a matching trigger already exists, and flag any SLA type that has no automation hook yet rather than silently doing nothing with it. Verify the config is readable/editable from one Admin screen covering every service, not per-service pages."

**"Bad-fit merge, flag don't force" applied a third time**: OTB's SLA shape (a working-day/working-hour business calendar, already built in `OtbRuleConfig`/Step 32) and Return Ticket's shape (a fixed day-offset per visa validity, in the pre-existing but never-editable `ReturnTicketRuleConfig`) both genuinely don't fit a generic per-service timeline row — kept on their own models/logic exactly as Steps 40 (Pricing) and 41 (Documents) did for their own bad-fit services. The "one Admin screen" requirement is satisfied at the UI level: the new `/admin/timelines` page embeds all three — the new generic `ServiceTimelinesManager` (one card per `ServiceType`, unrestricted by service) plus the existing `OtbRulesManager` and a first-ever Admin UI for `ReturnTicketRuleConfigManager` — replacing the old standalone `/admin/otb-rules` page.

**New `ServiceTimelineConfig` model**: one row per `ServiceType` (pre-seeded, self-healing on GET so there's never a "create" step), 4 nullable duration fields — `documentVerificationHours`, `expectedCompletionHours`, `quotationResponseMinutes`, `paymentDeadlineHours`. Confirmed no other dimension (country/vendor/processing-type) was actually asked for beyond service — the prompt's own "confirm rather than over-building" — so none were speculatively added.

**Wired into real logic, not just stored**: `quotationResponseMinutes` replaces the old Flight-Special-Fare-only hardcoded `FLIGHT_QUOTE_MAX_VALIDITY_MINUTES` cap inside `assertValidityWithinCap` — now applies to **any** service an Admin configures it for, falling back to the exact prior hardcoded 30-minute behavior for Flight Special Fare specifically when unconfigured, and to "no cap" for every other service when unconfigured (verified: an unconfigured service accepts any validity; a configured 10-minute cap rejects 20 minutes and accepts 5; resetting to unconfigured falls back to the original 30-minute Flight Special Fare behavior exactly). `paymentDeadlineHours` replaces the hardcoded 24h payment-link expiry in `createPendingPayment` — verified a configured 3h value produces a `linkExpiresAt` exactly 3h out on a real OTB payment, while an unconfigured service still defaults to 24h. `documentVerificationHours`/`expectedCompletionHours` are captured but have no existing automation trigger to wire into (Phase 5E's n8n jobs have no document-verification-SLA or completion-SLA job at all) — flagged explicitly rather than silently left inert, in the schema doc comment and directly in the Admin UI's field hint text ("Not yet wired into an automation reminder").

**Real build bug caught and fixed, not just a design decision**: making `assertValidityWithinCap` read from the DB (via `getServiceTimelineRules`) broke the production build — it lived in `src/lib/quotations/pricing.ts` alongside pure helpers (`isFlightQuote`, `capturesAirline`, etc.) that CRM Client Components (`QuoteBuilder.tsx`, `LeadDetail.tsx`) import directly, so the DB dependency (and transitively `pg`, via `db.ts`'s driver adapter) got pulled into the browser bundle (`Module not found: Can't resolve 'util/types'`). Fixed by splitting `assertValidityWithinCap` out into a new server-only `src/lib/quotations/validity-cap.ts`, leaving `pricing.ts` client-safe again — confirmed by a clean production build afterward.

Verified end-to-end against a real dev DB: all 6 `ServiceTimelineConfig` rows present after reseed; a 10-minute quotation-response cap configured for Flight Special Fare correctly rejects a 20-minute validity and accepts a 5-minute one; resetting it to unconfigured correctly falls back to rejecting 35 minutes and accepting 25 (the original hardcoded 30-minute behavior, unchanged); a 3-hour payment deadline configured for OTB produces a real payment's `linkExpiresAt` exactly 3h out, while NEW_VISA (left unconfigured) still defaults to 24h; `GET`/`PATCH /api/admin/return-ticket-rule-config` (the first-ever Admin route for this pre-existing model) round-trips real edits and was restored to its original values; the retired `/admin/otb-rules` page confirmed genuinely gone (404) while the underlying `/api/admin/otb-rules` route (now called from the embedded `OtbRulesManager`) still works. Also visually confirmed in Chrome: `/admin/timelines` renders all three sections (6 General Service Timeline cards, the embedded OTB card, the embedded Return Ticket card) with no console errors.

---

### Step 43 — New Visa Country Configuration screen ✅
**Audit ref:** Tier 2 §7
**Problem:** No screen exists for Admin to manage New Visa's countries (add/edit/activate/deactivate) connected to the Pricing/Documents/Timeline controls built in Steps 40-42.

**Prompt to use:**
> "Build the New Visa Country Configuration screen per Admin FINAL handover §7: country name/code, visa category, duration, processing type, description, terms and conditions — each country setup should reference the central Pricing (Step 40), Documents (Step 41), and Timeline (Step 42) controls rather than duplicating fields locally. This is also what Step 35's New Visa pricing depends on for its country dimension — sequence accordingly if Step 35 was built first with a placeholder shape. Verify New Visa's request flow (Step 35) picks up a country's configured price/documents/timeline correctly."

**No leftover placeholder shape to reconcile**: Step 40 had already fully retired the old `NewVisaPricing` model onto the central `PricingRule`, so by the time this step started, `computeNewVisaPrice` was already reading real central pricing — this step's "verify the request flow picks up a country's price/documents/timeline correctly" was genuinely a verification task, not a migration.

**New `NewVisaCountryConfig` model**: one row per `Country` (1:1, same pattern as `ReturnTicketDestination`) with §7's own listed fields — `visaCategory`, `duration`, `processingType`, `description`, `termsAndConditions`, plus `active`. Deliberately does **not** duplicate anything onto the shared `Country`/`PricingRule`/`DocumentRequirement`/`ServiceTimelineConfig` models — the Admin screen "connects to" those three controls by fetching their existing admin lists and filtering client-side for `NEW_VISA` + this country (a read-only `ReferencePanel` per country card: rule/document counts + a "Manage on Pricing/Documents/Timelines →" link each), never re-storing their values here.

**`visaCategory`/`duration`/`processingType` are descriptive, not a new pricing dimension** — a judgment call, flagged in the model's own schema comment: `PricingRule` has no `visaCategory` axis, so adding one here doesn't change how New Visa pricing is computed. The customer-facing request form's own `visaType` field (`new-visa-schema.ts`, still its pre-existing sample-data-driven selector) was deliberately left untouched — §7 doesn't ask to unify the two, and doing so would mean extending `PricingRule` with a new matching dimension, out of scope here.

**Real "remove", not just enable/disable** — §7 explicitly lists "remove" alongside add/edit/activate/deactivate (most masters in this project only get enable/disable), so `DELETE /api/admin/new-visa-countries/[id]` does a real hard delete + audit row, safe because nothing else references this row's id (a Lead only ever stores its destination country as a plain `Country.code` string).

**Confirmed the Step-42 Timeline control's known gap applies here too**: `ServiceTimelineConfig` has no `countryId` (a deliberate Step 42 "confirm rather than over-building" decision), so the Timeline reference panel shows the `NEW_VISA` service-wide row with an explicit "Timeline is configured per-service, not per-country, today" note rather than pretending a per-country value exists.

**Seed data**: one SAMPLE `NewVisaCountryConfig` row for UAE (a real locked-scope market country, per the Country seed migration — only the descriptive text is placeholder, clearly labeled `SAMPLE — ...` per hard rule #1).

Verified end-to-end against a real dev DB: full CRUD (create/update/enable-disable/remove) on a fresh country, duplicate-country-config rejected (400), `countryId` confirmed immutable via PATCH, unauthenticated access rejected (401); and — the concrete verification the prompt asked for — submitted a real New Visa lead for UAE and confirmed `computeNewVisaPrice` still resolved UAE's Step-40 `PricingRule` correctly (a live `payToken` was returned) and the post-payment checkout view still resolves `DocumentRequirement` via the same country-aware path Step 41 built, completely unaffected by this step's new model. Also visually confirmed in Chrome: the UAE sample card renders with all 5 fields, the live reference panel (3 pricing rules / 3 documents / "not configured" timeline, each linking out correctly), and the "Add New Visa Country" form — no console errors.

---

### Step 44 — Invoice Builder (Proforma + Tax) ✅
**Audit ref:** Tier 2 §13
**Problem:** Only a fixed `pdfkit` tax-invoice template exists (Phase 5A) — no Proforma option, no Admin-configurable company/bank/signatory details.

**Prompt to use:**
> "Build an Invoice Builder per Admin FINAL handover §13: support both Proforma and Tax Invoice (gated by the existing Tax/Fee config), with customer/company details, GST/HSN-SAC where applicable, invoice number/date, booking/reference ID, line items, discount, tax breakup, total, and payment details. Company logo/details/bank details/terms/signatory should be Admin-configurable (this overlaps with Step 45's System Configuration — decide which screen owns invoice-specific branding vs. site-wide branding and don't duplicate the field). Keep invoices linked to quotation/booking/payment records and printable/PDF-ready, extending `src/lib/invoices/render-invoice.ts` rather than replacing it outright if it can be generalized. Verify both invoice types render correctly for a real booking/payment."

**§13 vs. the not-yet-built Step 45 field split, decided and documented in the new model's own schema comment**: §19 ("System Configuration")'s "company information, branding" reads as site-wide identity, already ~90% covered by the existing static `site-config.ts` (name/address/phone/email — left untouched, unchanged). `companyGstNumber`/`companyLogoUrl` had no home anywhere and an invoice genuinely can't be built without them, so the new `InvoiceConfig` model adds them **now** rather than inventing a second copy later — when Step 45 is eventually built, it should read/edit these same two fields for its own company-info section, not duplicate them. Every other new field (bank/payment details, terms/notes, signatory) is invoice-only and has no other consumer, ever.

**Two independent gates replace the old hardcoded "TAX INVOICE" heading** (a real pre-existing bug — every invoice said "TAX INVOICE" even at 0% GST, the client's own locked default): (1) which record backs the invoice — a `Quotation` (pre-payment estimate) is always a **Proforma Invoice**, a `Payment` (status SUCCESS, money actually collected) is the real invoice; (2) whether GST was actually charged (`gstAmount > 0`) controls whether that real invoice calls itself "TAX INVOICE" (with a GST breakup line) or a plain "INVOICE" — exactly matching the client's "GST OFF → non-GST invoice" rule. A Proforma never shows GST at all (a Quotation has no GST computation today) and carries an explicit "for reference only, not a demand for payment" footer.

**New `buildInvoicePdfForQuotation()`** mirrors the existing `buildInvoicePdfForPayment()` — available for any quotation (selected or not, expired or not, since a Proforma is just a shareable estimate, not a payment record) via a new `GET /api/quotations/[id]/invoice` route and a "Download Proforma" button added to `QuoteCard.tsx`. Never exposes `vendorCost`/`margin` (same rule as everywhere else that pair appears).

**`renderInvoicePdf` restructured to cover every §13 field** without breaking its "pure PDF-drawing function, never fetches anything itself" contract (still true — logo/signature are pre-resolved Buffers by the time they reach it, fetched by a new shared `getInvoiceCompanyDetails()` helper in `src/lib/invoices/company-config.ts`): company logo image, GSTIN in the header, a Description/SAC/Qty/Rate line-item row, an explicit "Taxable Value" line (distinct from the gross rate once a discount applies), bank/payment details block, terms & notes, and a signatory block (name/title + optional signature image) that replaces the old generic "computer-generated, no signature required" footer once a signatory is actually configured.

**SAC not HSN** — this is a services business, not goods, so only a single Admin-configurable `defaultSacCode` was added (shown on every line item), not a full per-line HSN/SAC catalog; left null by default since a real SAC code is domain-specific tax data hard rule #1 forbids inventing. Same reasoning kept GST number/bank account number/IFSC genuinely blank in the seed (only `termsAndNotes` got a placeholder, since it's the one `NOT NULL` field) — real financial details are the client's to enter at `/admin/invoice-settings`, never invented here.

**Logo/signature upload** reuses the existing `local-file-storage.ts` helper (Phase 5D precedent) exactly as-is — no new storage code needed. Each image field PATCHes immediately on upload (not gated behind the text fields' "Save Changes"), since a file input has no natural "unsaved" draft state.

Verified end-to-end against a real dev DB: `GET`/`PATCH /api/admin/invoice-config` (self-healing, text fields, logo upload, signature upload, unauthenticated 401); a full OTB lead → quotation → Proforma download (valid `%PDF` bytes) → select → booking → payment → mark-success → Tax/plain-invoice download (valid `%PDF` bytes) chain at the default 0% GST rate (confirming the "INVOICE" not "TAX INVOICE" branch); then, with GST temporarily raised to 5%, a **second** full cycle confirming the payment's `gstAmount` was actually > 0 and its invoice still rendered correctly (exercising the "TAX INVOICE" heading branch) — GST rate restored to 0% afterward. Also visually confirmed in Chrome: `/admin/invoice-settings` renders every field including both image previews, the "Invoice Settings" nav entry highlights correctly, and the new "Download Proforma" button renders correctly on `QuoteCard.tsx` in the Lead detail page — no console errors.

---

### Step 45 — Admin System Configuration screen ✅
**Audit ref:** Tier 2 §19
**Problem:** Company info, branding, currency, timezone, data retention, backup, and maintenance-mode settings are scattered across env vars and hard-coded `site-config.ts` — no single Admin screen.

**Prompt to use:**
> "Build a System Configuration screen per Admin FINAL handover §19: company information, branding, currency, timezone, data-retention policy, backup settings, maintenance mode, and system notification preferences. Keep secrets (API keys) in env vars as already established (never move a secret into this DB-backed config) — this screen is for non-secret operational settings only. Maintenance mode should actually gate customer-facing routes when enabled (confirm the exact intended behavior — full site down vs. a banner — rather than guessing). Verify a changed setting (e.g. timezone) actually affects something real, not just gets stored inertly."

**Maintenance mode — asked the client directly rather than guessing, per the prompt's own explicit instruction**: confirmed a dismissible banner on customer-facing pages only, never a full site lockout. Reuses the exact `HideOnCrm.tsx` pathname-check pattern already established for the Navbar/Footer — the banner lives in the same wrapper, so it correctly never shows on `/crm/**`/`/admin/**` with zero new gating logic, and nothing in `/api/**` (webhooks, n8n automation) is touched at all.

**A real, structural bug caught during this step, not just a design decision**: wiring `getSystemConfig()` into the root layout (`src/app/layout.tsx`, shared by every single route) meant a transient DB hiccup during `next build`'s static-generation pass failed the **entire site's build**, not just one page — reproduced live (a flaky local Postgres connection under memory pressure broke the whole build on `/crm`). Fixed by making `getSystemConfig()` itself swallow any DB error and fall back to defaults (same resilience contract as `sendNotificationEmail()`/`sendSystemAlert()` — a config read failure must never cascade into a build or page failure), and wrapped it in React's `cache()` so the root layout's two separate calls to it (once from `generateMetadata`, once from `RootLayout` itself for the banner) collapse into a single DB query per request instead of two.

**§13/§19 field-ownership split, resolved as Step 44's own `InvoiceConfig` doc comment anticipated**: `SystemConfig.companyName/Tagline/Address/Phone/Email` (null = fall back to the static `site-config.ts` default) are the reuse point that comment pointed at — a new `getEffectiveSiteConfig()` merges them over the static defaults, now read by both the root layout's page metadata **and** every invoice PDF (`company-config.ts` was extended to call it) — the exact same override, no duplicate field anywhere.

**Every field's real-vs-informational status is stated in the schema's own doc comment and mirrored in the Admin UI's hint text, not left ambiguous**:
- **Wired to something real**: `currencyCode` (invoice PDF amounts, via a new shared `formatCurrency()` — deliberately display-formatting only, not a functional multi-currency switch, since this business only ever transacts in INR); `timezoneOffsetMinutes` (OTB's Urgent-processing working-hours cutoff — `src/lib/otb/processing-rules.ts`'s previously-hardcoded IST constant is now threaded through from the server-side caller only, the client-side form preview keeps the default, matching that file's existing "form guides, API enforces" split); `documentRetentionDays` (replaces the existing document-retention automation job's hardcoded 90-day constant); `systemAlertEmail` (a genuinely new mechanism — `recordAutomationRun()` now emails this address on any automation job's FAILURE, deliberately separate from the customer-facing NotificationTemplate/`notifyCustomer()` system, which nothing here touches).
- **Captured but explicitly NOT yet wired, flagged rather than silently built or silently ignored**: `auditRetentionDays` (§19's own "Suggested audit retention: one year, subject to final business confirmation" — no purge job exists for `AuditTrail` anywhere in this app, and building one was judged separate, net-new scope beyond this step); `backupRetentionDays`/`backupScheduleNote` (purely informational/reference — `scripts/backup-db.sh` is a cron/shell artifact with its own CLI args, it doesn't read this app's DB at runtime).

Verified end-to-end against a real dev DB: defaults confirmed on a fresh row (INR/330min/90-day/maintenance-off); unauthenticated access rejected (401); a direct unit-level test proved the timezone offset genuinely changes `workingHoursUntil`'s output (14h at UTC vs. 9h at the IST default, for the same inputs) rather than just being stored inertly; the document-retention job's real dry-run endpoint (with the real automation key) reflected a changed `documentRetentionDays`; a forced automation-job failure produced both a `FAILURE` `AutomationRun` row **and** a real alert email through the console-fallback sender (visible in its logged content) once `systemAlertEmail` was set; a company-name/address/currency override produced a still-valid Proforma PDF; and the maintenance banner appeared on the public homepage and correctly disappeared after being disabled — **caught and corrected one test-methodology bug along the way**: a raw-HTML substring check against `/crm/login` false-positived because Next's RSC hydration payload can contain a Client Component's serialized props even when that component's own render logic produces no visible output — verified visually in Chrome instead (screenshot confirmed no banner on `/crm/login`, banner + working dismiss button present on `/`). Also visually confirmed: `/admin/system-config` renders every section with correct wired-vs-informational hint text, and the "System Configuration" nav entry — no console errors.

**A second real bug, caught only once live on Vercel production (not reproducible in local dev, which always re-renders fresh)**: the homepage and other static customer pages are statically generated — a `SystemConfig` write sat invisible in the already-cached HTML until the next deploy, since a plain DB read inside a Server Component doesn't automatically opt a route into dynamic rendering. Fixed with `revalidatePath("/", "layout")` on every `PATCH /api/admin/system-config`, invalidating every route under the root layout on-demand — confirmed on production (`x-vercel-cache: REVALIDATED` on the next request) rather than forcing the whole site into dynamic rendering, which would have undone Next's static optimization for every marketing page.

---

### Step 46 — Admin sidebar: group into dropdown sections ✅
**Audit ref:** Tier 2 §20
**Problem:** `adminNavItems` is a flat list of ~25 items — the client wants grouped sections (People & Access, Service Configuration, Master Data, Vendors, Sales & Quotations, Finance & Invoices, Reports & Exports, System Settings).

**Prompt to use:**
> "Regroup the Admin sidebar (`src/lib/crm/nav-config.ts`'s `adminNavItems` + `AdminSidebar.tsx`) into collapsible grouped sections per Admin FINAL handover §20, using the client's suggested group names as a starting point. This is UI-only — every existing route/permission stays the same, only the navigation presentation changes. Verify every existing Admin page is still reachable, just organized, and that section visibility still respects each item's underlying permission check (not just hidden-but-reachable)."

**A real accordion, not just static group headers**: `crmNavGroups`/`CrmSidebar.tsx` already group the CRM's ~9 items under always-expanded headers — with ~25 Admin items across 8 named sections, showing every group open at once would defeat §20's own title, "Keep Sidebar Short." `AdminSidebar.tsx` was rewritten with a real single-open accordion (`useState<string | null>`) — opening one group collapses whichever was open, and the group containing the current page starts open so landing on a page never hides its own nav entry. "AI Command Center" stays ungrouped at the top, mirroring how `crmNavGroups` keeps "Command Centre" ungrouped.

**Every href is byte-identical to the old flat list — genuinely UI-only**: `adminNavItems` (flat array) was replaced by `adminNavGroups` (using the same existing `CrmNavGroup` type `crmNavGroups` already uses), but no route changed and nothing in the permission-checking chain was touched — every screen's own API route still calls its own `requirePermission(...)` exactly as before; this nav list was never the real access gate, only navigation, and that's unchanged.

**A few items don't map onto exactly one of the client's 8 categories unambiguously — placed by closest fit, documented as a judgment call in the code itself, not asserted as a hard rule from the handover doc**: New Visa Countries/Return Ticket Destinations/Service Statuses/Protection Plan → Service Configuration (alongside Pricing/Documents/Timelines, which §20 itself explicitly names as belonging there — same category of per-service business config); Coupons → Sales & Quotations rather than Finance & Invoices (a discount/sales tool, not money already collected); FAQs → Service Configuration (per-service content); Notification Templates → System Settings (cross-cutting, not scoped to one service); Automation → Reports & Exports (a read-only run-history monitor, not an editable setting).

Verified end-to-end: a full production build succeeded with every existing Admin route intact (confirmed in the build's own route table); visually confirmed in Chrome — clicking "Roles & Permissions" auto-expands "People & Access" (matching the current page) with every other group collapsed to just its header+chevron; clicking a different group's header (Master Data) collapses "People & Access" and expands Master Data's 5 items; clicking through to "New Visa Countries" (inside the newly-created Service Configuration group) navigates correctly — no console errors throughout. Two unrelated local-environment build failures were hit and resolved along the way (the local `prisma dev` instance had stopped — `ECONNREFUSED`, not a flaky-connection issue like Step 45's — restarting it fixed both the build and a subsequent reseed); neither was caused by this step's changes, which touch zero backend/database code.

---

## Phase 12 — Tier 3: CRM → "Internal Dashboard" overhaul (`Internal Dashboard Merged`)

**Source:** `client-message/ADMIN_CRM_CONSOLIDATION_AUDIT.md` Tier 3 — the largest and riskiest phase, since Step 49 (Lead status enum) is genuinely cross-cutting. Do Step 49 early and carefully, before building features that reference the new status list (53, 54).

### Step 47 — Rebrand: "CRM" → "Internal Dashboard"
**Audit ref:** Tier 3 §1 (naming only)
**Problem:** Every employee-facing label says "CRM" — the client wants "Internal Dashboard" in the employee-facing interface (Admin panel naming can stay as-is unless told otherwise).

**Prompt to use:**
> "Rename every employee-facing 'CRM' label to 'Internal Dashboard' (sidebar title, page titles, staff-facing copy) — this is a labeling change, not a route/URL restructure unless the client confirms they also want `/crm` renamed to `/dashboard` or similar (ask if unclear; renaming URLs breaks any existing bookmarks/links). Verify no user-facing 'CRM' text remains in the staff interface."

---

### Step 48 — New staff login page (Admin/Team Member types, Google, Forgot Password)
**Audit ref:** Tier 3 §1
**Problem:** `/crm/login` is one plain email/password form — no login-type selector, no Google option, no password reset anywhere in the app (customer-facing Google login is also still a placeholder — see H10).

**Prompt to use:**
> "Redesign the staff login page per Internal Dashboard Merged §1: one page with an Admin Login / Team Member Login selector (suggested employee caption: 'Welcome back! Let's make every journey seamless.'), plus Google Login and Forgot Password. Google login for staff needs real `GOOGLE_CLIENT_ID`/`SECRET` the client hasn't provided yet — build the button as a clearly-labeled placeholder (same `isPlaceholder()` pattern used everywhere else) rather than a fake flow. Forgot Password needs a real reset-token + email flow (reuse the Resend integration) — build this one for real since it needs no new credentials. Verify: both login types authenticate correctly against the existing staff session system, and a forgot-password request actually emails a working reset link."

---

### Step 49 — Lead Status enum migration (7 → 11 values)
**Audit ref:** Tier 3 §6 — **do this carefully, as its own reviewed step; it's the most cross-cutting change in this phase.**
**Problem:** Current `LeadStatus` (`NEW/CONTACTED/QUALIFIED/QUOTED/CONVERTED/ON_HOLD/LOST`) doesn't match the client's suggested list (`New/Contacted/Follow-up Required/Customer Responded/Qualified/Quotation Created/Quotation Accepted/Payment Pending/Converted/Lost/Closed`).

**Prompt to use:**
> "Migrate `LeadStatus` to the client's 11-value list from Internal Dashboard Merged §6. This touches: the Prisma enum + migration (Postgres enum changes need care — added values are safe, removed/renamed values need every existing row mapped first), `src/lib/leads/transitions.ts`'s transition map, every place that writes a `LeadStatus` (quotation-select, payment-mark-success, WhatsApp bot, n8n automation), `LeadStatusBadge.tsx` and any other status-display component, and Lead Temperature (`Hot/Warm/Cold/Not Set` — confirm this matches the existing `LeadTemperature` enum, likely just an added 'Not Set' default). Write a data migration mapping every existing Lead's current status to the closest new one (e.g. QUALIFIED→Qualified, QUOTED→'Quotation Created' or 'Quotation Accepted' depending on whether it's selected, ON_HOLD→closest fit, propose the exact mapping for review rather than guessing silently). Verify: every existing Lead still has a valid, sensible status after migration, and every status-transition code path (quotation select, payment success, staff manual status change) still works end-to-end."

---

### Step 50 — Employee rosters + "Unassigned" display rule
**Audit ref:** Tier 3 §2
**Problem:** Unassigned leads just show `assignedStaff: null` today; there's no roster-based assignment or the specific "show Unassigned but still display the inactive assignee's name" rule.

**Prompt to use:**
> "Per Internal Dashboard Merged §2: remove the general 'Unassigned' filter/section as a first-class bucket (keep it derivable, not a dead-end). When a record's assigned employee is inactive, the UI should show 'Unassigned' as the effective state while still displaying the originally-assigned agent's name for context (e.g. 'Unassigned (was: Staff Name)'). Assignment should route through Step 39's service-wise permissions and existing roster/auto-assign logic (Phase 6) — confirm this doesn't conflict with Step 38's leave-approval gating. Verify: reassigning a lead away from a now-inactive staff member works, and the inactive staff member's name still shows in the record's history even after reassignment."

---

### Step 51 — Manual/Offline Lead & Payment Collection form
**Audit ref:** Tier 3 §8
**Problem:** No staff-facing form exists to create a Lead for a customer who contacted TripNexio offline (phone/walk-in) — every Lead today only comes from a customer's own website/WhatsApp submission.

**Prompt to use:**
> "Build a Manual Lead / Offline Payment Collection form in the CRM per Internal Dashboard Merged §8: Name, Mobile, Email, Source, Service (+ 'Other'), Travel Date, traveller count, Adult/Child details. For fixed-rate services (New Visa post-Step-35, OTB, Return Ticket), auto-calculate the amount from the Pricing Control (Step 40); allow staff to apply eligible coupons and permitted extra charges. After creation, offer a Payment Link (reuse `createPendingPayment`) or Bank Transfer option with a slip-upload field; a confirmed bank transfer needs an explicit staff approval step before the booking converts (reuse/extend the existing mark-success pattern, gated by permission). If a service needs a quotation instead, route to Quotations; if payment isn't completed, keep it as a Lead for follow-up. Verify the full path for one fixed-rate service (payment link) and one bank-transfer path (upload slip → approve → booking converts)."

---

### Step 52 — Extra Payment Collection against an existing Booking
**Audit ref:** Tier 3 §9
**Problem:** Today's payment flow only ever creates one payment tied to a booking's selected quotation — there's no "charge this booking again" path for an add-on/extra fee.

**Prompt to use:**
> "Add Extra Payment Collection per Internal Dashboard Merged §9: staff search by Booking ID or Lead reference, the system auto-fetches customer/booking details, and staff create an additional payment (amount, reason/description) against that booking — reuse `createPendingPayment`'s gateway-link logic but decouple it from requiring a *newly selected* quotation, since the booking is already confirmed. Show extra-payment transactions in their own filterable, CSV-exportable report, separate from the primary per-booking payment list. Verify a booking can receive a normal payment and a later extra payment, both tracked distinctly."

---

### Step 53 — Command Centre rebuild: action-based KPIs
**Audit ref:** Tier 3 §3 — build after Step 49 (Lead status) is stable, since these KPI groupings reference specific statuses.
**Problem:** The existing `/crm` dashboard (Phase 3A) shows counts; it's not action-based with the specific groupings the client wants, and cards aren't clickable into filtered lists.

**Prompt to use:**
> "Rebuild the Command Centre per Internal Dashboard Merged §3: a Sales Overview group (New/Hot/Warm/Cold/Qualified Leads, Quotations, Accepted Quotations, Conversion Rate, Payment Pending, Payment Received) and an Operations Overview group (Active Bookings, Documents Pending, Customer Action Required, Staff Action Required, External Processing, Delayed Bookings, Refunds Raised, Completed Bookings), plus a 'Most Action Required' section (overdue follow-ups, approaching travel dates, pending documents/payments, quotations awaiting approval, pending refunds, delayed bookings, unassigned-due-to-inactive-staff work). Every KPI card and action item must be clickable, opening the relevant screen pre-filtered. Verify each card's number matches what its linked filtered list actually shows."

---

### Step 54 — Standardize date-range filters + CSV export across major CRM sections
**Audit ref:** Tier 3 §4
**Problem:** Some list screens have filters, but not the specific Last-7/30/90-days + custom-range pattern, consistently, everywhere.

**Prompt to use:**
> "Add a shared date-range filter component (quick options: Last 7/30/90 Days, plus a custom range) and CSV export to every major CRM list screen that doesn't already have both (Leads, Quotations, Bookings, Payments, Refunds, and any new screens from Steps 51-53) — build one reusable component/hook rather than repeating the pattern per screen. Verify filtering + export works consistently across at least 3 of these screens."

---

### Step 55 — Extend customer self-upload to all 6 services
**Audit ref:** Tier 3 §11 (partial — staff-side upload already exists)
**Problem:** Customers can only upload their own documents post-payment for Return Ticket/OTB (H7's `/pay/<token>` page). The other 4 services have no customer-facing upload surface at all outside the pre-lead flows already built (H1/H3/H4/H34).

**Prompt to use:**
> "Extend customer document upload to the other 4 services, reusing H7's `/pay/<token>` document-upload pattern where a post-payment upload makes sense, or the customer's `/account` page (H10) for anything requested after the fact (e.g. a staff-requested additional document). Every upload must stay linked to the correct Lead/Booking and applicant, and be recorded in the activity timeline — confirm both already hold for the existing upload paths before extending. Verify a customer can upload a staff-requested additional document for a non-checkout service and staff see it immediately."

---

### Step 56 — Staff-composed email from the CRM, with AI-assisted drafting
**Audit ref:** Tier 3 §13
**Problem:** All email today is system-triggered (`notifyCustomer()` on specific events) — there's no "staff writes a free-form email to this customer" feature, and no AI drafting assistance for email or WhatsApp messages.

**Prompt to use:**
> "Add a 'compose email' action on a Lead/Customer/Booking (CRM) that sends from the official company email via the existing Resend integration, logged to the activity timeline exactly like system-triggered emails. Add an AI-assist action (reuse the existing Claude integration pattern from the WhatsApp bot/OCR work) that drafts, improves, or corrects a message the staff member is writing — for both this email composer and CRM-side WhatsApp replies, if a CRM-side WhatsApp reply surface doesn't exist yet, flag that as a prerequisite rather than assuming it. Verify a staff-sent email is delivered (or console-logged in dev, per the existing swappable-provider pattern) and shows up in the customer's timeline."

---

### Step 57 — Dashboard shortcuts / navigation polish
**Audit ref:** Tier 3 §12
**Problem:** Coupons, FAQs, Refunds, Tasks, and Payment Link Generation already exist as separate screens but aren't surfaced as quick shortcuts from the main dashboard.

**Prompt to use:**
> "Add dashboard shortcuts per Internal Dashboard Merged §12 for Coupons, FAQs, Refunds, Tasks, and Payment Link Generation (make the last one genuinely easy to reach for both online and offline/manual customer handling — link it from both the Command Centre and Step 51's manual-lead flow). A 'Knowledge Centre' isn't built anywhere yet — confirm with the client what this should actually contain (internal staff documentation/SOPs?) before building it, rather than guessing its scope. This is primarily navigation/UX — verify every shortcut lands on the correct existing screen."

---

## Pre-existing pending items (from before Phase 9), closed 2026-09-23

- **Customer login/register**: real sessions built — see H10 below (Phase 9 tracker).
- **WhatsApp button-menu (Step 30)**: done — see Step 30 above.
- **Deployment governance runbook (Step 31)**: done — `docs/deployment/DEPLOYMENT_RUNBOOK.md`.
- **og-image.png**: added.

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
11. Steps 32-35 (Phase 10, Tier 1 fixes) — small, do these first of the new work; Step 35 (New Visa payment pivot) is the biggest.
12. Steps 36-46 (Phase 11, Admin consolidation) — masters/foundations (36-39) before the central Pricing/Documents/Timeline controls (40-42), which Step 43 depends on; 44-46 are lower-risk additions.
13. Steps 47-57 (Phase 12, Internal Dashboard) — do Step 49 (Lead status migration) early and carefully; Steps 53-54 depend on it being stable first.

At each step, follow `CLAUDE.md`'s existing hard rules: no invented domain data, work incrementally, migrations via Prisma and committed to git, commit after each working unit, and give numbered next steps at the end of every response.
