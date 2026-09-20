# TripNexio — Read-Only Gap/Audit Report

**Prepared:** 2026-09-07
**Type:** Read-only audit per `TRIPNEXIO_MASTER_BLUEPRINT_v2.md` §28 ("READ-ONLY AUDIT BEFORE IMPLEMENTATION"). No code, schema, or data was changed to produce this report.

**Method:** Every client-message file under `E:\TripNexio\client-message\` was re-read in full (not from memory/summary): `00_Project_Overview.md`, `TRIPNEXIO_MASTER_BLUEPRINT_v2.md`, `message.txt`, `CRM.md`, `ADMIN.md`, `New_Visa.md`, `Visa_Extension.md`, `Visa_Change.md`, `Flight_Special_Fare.md`, `Return_Verified_Ticket.md`, `OTB.md`, plus the Upwork PDF transcript. The codebase was inspected directly: `prisma/schema.prisma` in full, every route under `src/app/api/**`, every screen under `src/app/crm/**` and `src/app/admin/**`, sidebar/nav configs, and targeted greps of `src/lib/**` for task/communication/dashboard/search/expense/roster/snapshot concepts.

## Status Legend

- **BUILT** — matches the locked spec.
- **PARTIALLY BUILT** — something real exists but diverges or is incomplete; the exact divergence is stated.
- **MISSING** — spec exists, nothing built.
- **CONFLICTING** — what's built actively contradicts the locked spec (wrong numbers, wrong data shape, or a rule the build violates).
- **NOT SPECIFIED / OPEN QUESTION** — genuinely undocumented on both sides, including items the client's own docs explicitly leave open (e.g. `ADMIN.md` §45's 8 listed open items).

Note on vocabulary: `TRIPNEXIO_MASTER_BLUEPRINT_v2.md` §27 prescribes its own 6-label set (`BUILT / PARTIALLY BUILT / DOCUMENTED ONLY / CONFLICTING / NOT BUILT / NEEDS AUDIT`) with the explicit caution "*Documentation is not proof that corresponding code is complete.*" This report's 5-label set is a reasonable adaptation (MISSING ≈ NOT BUILT, and every item here has in fact been audited, so NEEDS AUDIT doesn't apply) — flagged here for transparency, not treated as a deviation worth blocking on.

---

## 1. Reconciled Points

Two apparent contradictions between the client-message docs and the built codebase were already resolved earlier in this engagement, via the Upwork PDF chat transcript:

1. **Legacy-database warnings** (`TRIPNEXIO_MASTER_BLUEPRINT_v2.md` §19–21: "the legacy Master Blueprint documents existing work... do not rebuild these blindly," "NEVER `npx prisma migrate reset`," references to a pre-existing `flight_enquiries`/`flight_quote_options` schema and "existing Express/auth architecture") are explained by the client's agreement to **delete the old repository** and start the current Next.js/Prisma 7 codebase fresh. These warnings describe a codebase that no longer exists in this repo — confirmed the current schema has no `flight_enquiries`/`flight_quote_options` tables and the staff-auth system is a custom JWT/`jose` implementation, not Express. **Resolved, no action needed** — but see the new item below this list; the "existing Express/auth architecture" phrase specifically was not re-substantiated by this round's re-read and is restated as a residual open question.
2. **Figma-first phasing** (`TRIPNEXIO_MASTER_BLUEPRINT_v2.md` §5, §22–24: *"Design the Website first,"* full Figma deliverable list, `WEBSITE FIGMA UI/UX MD → FIGMA DESIGN → PROTOTYPE → WEBSITE APPROVAL`, and the explicit gate *"Do not begin major CRM/Admin redesign before the website direction is approved"*) is explained by the client and Claude Code agreeing, later in the Upwork chat, to **cancel Figma in favor of direct design-in-code** — confirmed via `message.txt`. This explains why no Figma files exist and why the homepage was built directly against a reference image (`BRAND ASSEST/refrence-desgin-home.webp`). **Resolved, no action needed.**

**Still open, and this round's re-read could not close it:** neither `TRIPNEXIO_MASTER_BLUEPRINT_v2.md` nor `00_Project_Overview.md` contains the words "delete the old repository" or "cancel Figma" anywhere — both reconciliations rest entirely on `message.txt`/the Upwork PDF, not on the two documents that carry the project's formal locked-scope language. This is a paper-trail gap worth closing (e.g. a one-line addendum in the Master Blueprint itself) rather than a functional gap, but it is exactly the kind of thing a §28 audit exists to surface.

**Newly surfaced, not previously flagged:** `TRIPNEXIO_MASTER_BLUEPRINT_v2.md` §19 still lists "existing Express/auth architecture" as part of the "Protected Technical Foundation" to preserve. The current codebase has no Express anywhere (Next.js API routes) and a bespoke JWT staff-auth system, not whatever auth architecture §19 refers to. This is very likely swept up in reconciliation point #1 above (old repo deleted, so its auth architecture went with it) — but nothing in the client-message files says so explicitly. **NOT SPECIFIED / OPEN QUESTION** — worth a one-line client confirmation, low urgency given #1 above almost certainly covers it.

**The phase-order violation, stated plainly:** `TRIPNEXIO_MASTER_BLUEPRINT_v2.md`'s own prescribed sequence (§22, §25) is `Website Figma → Website Approval → CRM → Admin → WhatsApp AI + Notifications → Testing/Deployment`, with an explicit instruction not to start major CRM/Admin work before website approval. What was actually built, in order, is: a homepage (M1) → two service-request frontends out of six (OTB, New Visa) → the full Prisma schema and lead-intake API (M2) → the **entire CRM workspace** (Leads, Quotations, Bookings, Payments, Refunds, Documents — Phase 3A–3D) → the **entire Admin RBAC + all ten masters + config screens** (Phase 4A–4D) → **Razorpay payments, Resend email, WhatsApp Cloud API + bot, OCR, and n8n automation** (Phase 5A–5E). In other words, essentially all of Phases 2–5 of the client's own prescribed order were built while 4 of 6 customer-facing service journeys still don't exist and the website itself was never presented for a formal approval gate. This is not by itself a defect in any individual feature — the backend work is, on inspection, mostly solid — but it means the project has been built back-to-front relative to its own governing document, and the client has not yet had the "approve the website, then we build the engine behind it" checkpoint the Blueprint calls for. **This is the single most important structural finding in this audit** and is reflected as punch-list item #1 below.

---

## 2. Website — Customer-Facing Service Journeys

### 2.1 New Visa

**Frontend**: **BUILT** — `/services/new-visa`, `/services/new-visa/request` (`src/components/forms/NewVisaRequestFlow.tsx`, `src/lib/validation/new-visa-schema.ts`), wired to a real lead-intake API (`POST /api/leads/new-visa`).

Compared against `New_Visa.md`'s much richer spec, several structural pieces are **MISSING**:
- **Buyer vs. Passenger split with parent-linking** — the spec (§1, §6) requires under-18 passengers to be linked to a specific parent passenger in the same booking, with a disclaimer, and blocks a child from proceeding without a linked parent. `Passenger` (`prisma/schema.prisma`) has no `parentPassengerId` or equivalent self-relation — **MISSING**.
- **Protection Plan** (§8–9: passenger-wise, default ₹5,000/eligible passenger admin-configurable, mandatory T&C acceptance stored against the Booking, 14-status lifecycle, eligibility review as a CRM task) — **MISSING entirely**. No `ProtectionPlan` model, no field on `Passenger`/`Quotation`/`Booking`, no mention anywhere in the codebase per the schema/API inspection. This is a named, priced, revenue-bearing feature with zero implementation.
- **13 customer-facing vs. 18 internal-CRM status split** (§10) — `Lead.status`/`Booking.status` are single enum columns; no customer-safe status mapping exists anywhere in the schema or `src/lib` (confirmed by direct grep). **MISSING** structurally, see §7.3 below for the cross-cutting version of this finding.
- **CRM Task Engine auto-generation** (§12: tasks for missing docs, OCR mismatch, passport <6mo validity, Protection Plan eligibility, embassy resubmission, etc.) — **MISSING**, no `Task` model exists anywhere (confirmed by grep across `src/lib`, `src/app/api`).
- **3-month document reuse/retention window + auto-delete after processing** (§17–18, §27: exact "≤3 months → offer reuse" / ">3 months → request new" / retain only Passport Front + Visa PDF after 3 months, delete everything else) — **MISSING**. No retention/purge job exists (confirmed no cron/automation route implements this; the four existing n8n automation routes are quote-expiry, payment-followup, OTB-requirement-check, and lead-followup — none touch document retention).
- **Additional-charges-stay-under-same-Booking-ID flow** (§26) — **MISSING**, no such API route exists.
- **Expected Travel Date minimums** (§7: Normal ≥7 days, Express ≥3 days, admin-configurable working-days calendar) — **NOT VERIFIED as built**; no working-days/holiday-calendar concept found anywhere in `src/lib` or the schema. Treated as **MISSING** pending a closer look at `new-visa-schema.ts`'s exact date validation, which this audit did not line-by-line diff.

### 2.2 Visa Extension

**Frontend**: **MISSING** — per CLAUDE.md's own build log, Visa Extension has a zod schema and a working `POST /api/leads/visa-extension` route, but **no customer-facing page exists** (`/services/visa-extension` was never built). Only reachable via direct API call.

Even judged as an API-only implementation, several **locked, numbered rules** in `Visa_Extension.md` are not reflected in the current API-level rule set (this audit did not re-open `visa-extension-schema.ts` line-by-line, but the CLAUDE.md build log makes no mention of any of the following, and none showed up in the schema/route inspection):
- **Eligibility gate**: "only visas originally issued through TripNexio," with an explicit no-Extension-Booking-until-verified rule (§2) — the current route creates a Lead directly from form input with no cross-check against a prior TripNexio-issued Visa booking. **MISSING/CONFLICTING** depending on exact route logic (needs direct code diff before finalizing as CONFLICTING; flagged here as a real risk).
- **≥30-day-expired = permanently ineligible; expires-today = urgent same-day-6PM cutoff** (§9) — a very specific, numeric eligibility rule with no evidence of implementation.
- **"Not Accepted" vs. "Rejected" as two different outcomes with different refund treatment** (§17–18: Not Accepted → refund minus gateway charges; Rejected → no refund) — the generic `RefundStatus` enum (`PENDING/PROCESSING/COMPLETED/REJECTED`) has no way to distinguish these two business outcomes. **CONFLICTING** with the refund-calculator's single generic formula (see §7.4).
- **New Extension Booking ID linked to the original visa Booking** (§19, "Core Locked Decision #28") — no parent-booking-reference field exists on `Booking` in the schema. **MISSING**.
- **Day-25 re-extension reminder** — not among the four built n8n automation workflows. **MISSING**.

### 2.3 Visa Change

**Frontend**: **MISSING** — same status as Visa Extension: schema (`visa-change-schema.ts`, a `z.discriminatedUnion` on A2A vs. Border) and a working `POST /api/leads/visa-change` route exist and were verified to do a live DB lookup against real `Airport`/`Border` master rows, but no customer-facing page was ever built.

The API-level implementation is comparatively strong versus the spec on one specific point: `Visa_Change.md` §1–3's locked rule that "customer must never manually enter airport or border names" is genuinely enforced server-side (the route requires master-record ids, not free text) — **BUILT**, for that one rule, even without a frontend.

Gaps against the fuller spec:
- **Mandatory Border-side fields with a hard "do not generate a package" gate** (§10: Pickup Location, Reporting Time, Pickup Person Name, Customer Contact Number all mandatory) — not confirmed present in the current schema (not line-by-line diffed this round). Flagged **NOT VERIFIED / likely PARTIALLY BUILT**.
- **Two-phase pricing gate** (§17: no price shown until sponsor/vendor availability confirmed AND date/time/package selected) — the current lead-intake flow is a single-shot form submission with no "availability confirmed, now price" second phase. **MISSING** (this is architecturally a CRM quote-builder concern more than a customer-form concern, and the CRM's `QuoteBuilder` does let staff quote after the lead exists — so the two-phase *shape* may already exist informally via Lead→Quotation, just not badged as this specific gate).
- **Exit Completed staff-only manual confirmation step**, **A2A/Border PDF package generation** — **MISSING**, no PDF-package generation code exists for Visa Change specifically (the only PDF generator in the codebase is the payment invoice, `src/lib/invoices/render-invoice.ts`).
- No refund/cancellation numbers are given anywhere in `Visa_Change.md` itself (unusual versus the other four services) — correctly **NOT SPECIFIED / OPEN QUESTION** on the client side, so the codebase's generic refund calculator applying here isn't a conflict, just an area with no locked target to conflict with.

### 2.4 Flight Special Fare

**Frontend**: **MISSING** — schema + `POST /api/leads/flight-special-fare` route exist, no page.

The CRM-side quote builder (Phase 3C) is genuinely strong here and does implement several `Flight_Special_Fare.md` §12 locked rules correctly: **BUILT** — multiple quotes/alternative-route quotes via `alternativeOfId`, admin-adjustable-up-to-30-minute validity cap (`FLIGHT_QUOTE_MAX_VALIDITY_MINUTES`), selecting one quote expires siblings, vendor cost/margin never customer-facing. This is one of the better-aligned areas of the whole build.

Gaps:
- **10-minute reminder while a quote is live** — `QuoteCountdown.tsx` is a client-side visual countdown only; the actual reminder-notification event (`QUOTE_REMINDER`) exists as a seeded `NotificationTemplate` with **no trigger** until the n8n Quote-Expiry-Handling workflow (Phase 5E) — that workflow does send `QUOTE_REMINDER` "once a quote is within 15 minutes of lapsing," which is close to but not exactly the spec's "every 10 minutes" cadence. **PARTIALLY BUILT** — a reminder exists, fires once not repeatedly, and at a 15-minute-out threshold rather than a 10-minute interval.
- **Adult=12+/Child=2–11/Infant<2 classification from DOB** (§12) — `PaxType` enum in the schema is only `ADULT`/`CHILD`, **no `INFANT` value exists**, even though `Quotation.infantFare` exists as a field. **CONFLICTING** — the pricing model has an infant fare column but the passenger-type enum has nowhere to record an infant passenger.
- **45-day max travel window, 7-day follow-up cadence** — not confirmed implemented anywhere; the lead-followup n8n job (Phase 5E) fires for stalled leads generically at 3+ days, not specifically 7-day flight-quote follow-ups. **MISSING/PARTIALLY BUILT** (generic mechanism exists, doesn't match this service's specific cadence).

### 2.5 Return Verified Ticket

**Frontend**: **MISSING** — schema + `POST /api/leads/return-ticket` route exist, no page.

The single most important locked rule in this service's spec — **`Return_Verified_Ticket.md` §16–17, stated twice for emphasis: once documents are validated and forwarded to the vendor/airline, the booking becomes non-refundable, even before ticket issuance; there is no partial-refund tier at all post-validation, unlike OTB/New Visa's ₹250 tier** — has **no corresponding enforcement anywhere in the codebase**. The generic refund route (`POST /api/payments/[id]/refunds`) applies the same `paidAmount − cancellationCharge − gatewayCharge` formula regardless of service type or how far processing has progressed; nothing blocks a refund attempt on a forwarded-to-vendor Return Ticket booking. **CONFLICTING** — this is a genuine business-rule violation risk if refunds ever get exercised against this service type before the rule is implemented.
- **System-generated return/onward date** (customer only picks Visa Type + Travel Date, §5–6) — not confirmed in the current schema/route.
- **24-hour issue-then-expire reservation window**, and the **"Expired Reservation" exception status** (§7, §24) — **MISSING**, no such status or expiry-tracking field exists on `Booking`/`Quotation` for this service.

### 2.6 OTB

**Frontend**: **BUILT** — `/services/otb`, `/services/otb/request`, wired to `POST /api/leads/otb`. This is the most complete customer-facing journey in the app.

Server-side rule enforcement that **is** genuinely built and matches spec: `OTB.md` §3/§15 "nationality is never asked" is enforced defensively — `createLeadFromSubmission` strips a nationality field if one ever shows up (per CLAUDE.md's lead-creation API notes). **BUILT.**

Gaps:
- **Existing-customer flow with flight-ticket/return-ticket reuse-and-linking logic** (§3) — the current OTB flow is a single flat form; no "have you already got a return ticket / bought your flight through us" branching exists. **MISSING**.
- **OTB↔Return Ticket automatic linkage, OTB-must-complete-before-Return-Ticket-issues** (`CRM.md` §15) — no relation exists between an OTB `Lead`/`Booking` and a Return Ticket one in the schema (no cross-service FK). **MISSING** — this is a named, locked, cross-service rule with zero data-model support today.
- **Refund figure**: `OTB.md` §16/§24 rule 24 states **"after documents validated: deduct ₹250 service charge + gateway charges."** The codebase's own refund calculator (`src/lib/refunds/pricing.ts` / the CRM refund route, documented in CLAUDE.md's Phase 3D notes) uses **`SAMPLE_OTB_FIXED_SERVICE_CHARGE = 500`**, explicitly self-flagged at the time as a placeholder pending the real figure from the client ("no actual figure... was ever specified anywhere"). **That figure is now known from `OTB.md` and the codebase's ₹500 is wrong — it should be ₹250.** This is a clean, concrete **CONFLICTING** finding with an exact fix (change one constant) once approved.
- **Airline-level OTB Normal/Urgent pricing + working-hours availability logic** (§4, §7) — `Airline.normalPrice`/`urgentPrice`/`otbRequired` fields exist in the schema (BUILT as data model), but there is no evidence any working-hours/6-hour-before-departure/urgent-availability *logic* was implemented anywhere in `src/lib` — pricing fields exist, the rules engine around them doesn't. **PARTIALLY BUILT.**

### 2.7 Track Status

**PARTIALLY BUILT** — `/track` (`TrackStatusExplorer.tsx`) exists with all three CLAUDE.md-mandated data-view states (loading/empty/error) and a real `StatusTimeline` component, but it still searches `src/lib/mock-api/track.ts`'s small fixed sample set, **not the real `Lead`/`Booking` tables**. No customer-facing tracking API exists (`GET /api/track` or similar was not found in the route inventory). Given there's no customer login yet, this is expected to remain unwired until Auth.js customer sessions exist — but it means the "Track Status" nav item promised on the homepage doesn't actually track anything real today.

### 2.8 Ask TripNexio AI

**PARTIALLY BUILT / CONFLICTING with the eventual intent** — `/ai` (`AiChatShell.tsx`) is explicitly labeled a preview and always shows a single canned reply, steering to WhatsApp/Browse Services. Meanwhile a **real** Claude-powered intent-detection + constrained FAQ-answering engine (with an explicit hallucination guard, `NOT_FOUND` sentinel) was built for the **WhatsApp bot** in Phase 5C (`src/lib/whatsapp-bot/ai-provider.ts`). The real AI engine exists in the codebase but is not wired to the website's own Ask AI surface — a customer asking a question on the website gets a canned non-answer while the same question on WhatsApp gets a real Claude-backed answer. This asymmetry is worth closing (reuse `ClaudeAiProvider`/`answerFaqOrHandoff` on the website route) rather than building a second AI pipeline.

### 2.9 Customer Auth

**MISSING** (by design, explicitly documented as such) — `/login`/`/register` are UI mockups only; no Auth.js, no real session, no Google OAuth, no guest-checkout persistence. This matches CLAUDE.md's own "Auth" section note that this is still entirely M2/unbuilt. Not a gap this audit needed to discover — already correctly tracked as not-yet-started.

---

## 3. CRM (Staff Workspace)

### 3.1 Leads

**PARTIALLY BUILT / CONFLICTING on data shape.** `LeadsTable.tsx` (backed by `GET /api/leads`) is a real, functional, filterable/sortable **table** with loading/empty/error states — solid engineering. But measured against `CRM.md` §3–6:
- **CRM.md §3 prescribes Leads living under a "Sales" nav group alongside Customers/Quotations, itself under a broader Command Centre-anchored nav** (Command Centre / Sales / Operations / Resources / Analytics / Communication / Help / Profile). The actual nav (`src/lib/crm/nav-config.ts`) is a flat 7-item list (Leads, Customers, Quotations, Bookings, Payments, Refunds, Documents) with no grouping and no Command Centre entry at all. **CONFLICTING** with the prescribed information architecture, not just "simpler."
- **Lead Kanban / pipeline view** — CRM.md doesn't explicitly mandate a Kanban, but the "Most Action Required" primary-queue concept (§4) strongly implies something beyond a flat table. Confirmed via direct inspection: **no Kanban/drag-drop exists** (no `@dnd-kit`/`react-beautiful-dnd`/`react-dnd` in `package.json`). **MISSING** relative to the operational-queue concept described.
- **Lead temperature (Cold/Warm/Hot)** — an explicitly named field in CRM.md §5's Lead field list and a KPI category in the Command Centre spec (§4: "New/Hot/Warm/Cold/Qualified Leads"). **No such field exists on the `Lead` model.** **MISSING.**
- **Service-specific lead-creation forms** with the exact per-service field lists in §6 (e.g. Visa Change's A2A-vs-Border branching, OTB's Normal/Urgent selector at lead stage) — the actual per-service intake schemas (`otb-schema.ts` etc.) were built independently against the individual service MDs, not against this CRM.md field list; a full diff wasn't performed this round, but the schema's reliance on a single untyped `Lead.details` JSON blob (see next point) means CRM.md's field list isn't surfaced as structured, filterable CRM columns even where the underlying form captured the data. **PARTIALLY BUILT.**
- **Structural finding**: `Lead.details` is a single `Json` column holding everything service-specific (including the makeshift `passengerIds` array noted in CLAUDE.md as a "fix once multi-named-passenger UI exists"). This means Country, PAX, Adult/Child count, Sub-service, and every other per-service field CRM.md wants as a first-class, filterable, reportable column is currently unindexed and unqueryable JSON. **PARTIALLY BUILT / architecturally fragile** relative to the reporting and filtering the spec expects (§4 Sales Overview KPIs, §29 Reports both assume structured queries over these fields).

### 3.2 Quotations

**PARTIALLY BUILT.** The API (`/api/quotations/**`) and the embedded `QuoteBuilder` on the Lead detail page are functionally strong (verified end-to-end per CLAUDE.md's Phase 3C notes: margin math, validity cap, alternative routes, expiry sync). But:
- **No standalone Quotations list screen** — `/crm/quotations` is confirmed to render `<CrmComingSoon title="Quotations" />` despite the full CRUD API existing underneath. CRM.md §3 lists Quotations as its own nav item under Sales; today it's only reachable by opening a specific Lead first. **PARTIALLY BUILT** — the engine exists, the promised standalone screen does not.
- **Coupon integration into the pricing formula** — CRM.md §10's locked formula is `Configured Service Amount + Additional Amount + Fine − Coupon + Gateway Charge = Customer Payable`. The `Quotation` model has `feeAmount`/`fineOrCharges`/`vendorCost`/`sellingPrice`/`margin` but **no coupon field at all** — coupons exist only as a standalone Admin-managed `Coupon` master with `usageCount` that is never incremented (confirmed: no checkout flow reads or applies a coupon anywhere). **MISSING** — Coupons are modeled as reference data but never actually enter a real price calculation.

### 3.3 Bookings

**PARTIALLY BUILT / CONFLICTING on one specific structural rule.** List + detail screens are real and functional (`BookingsTable`, booking detail page), matching CRM.md §11–12's general shape reasonably well (status + latest-payment-status badges, service-specific date labels are close in spirit though not confirmed field-for-field).

The one clear conflict: **CRM.md §12 explicitly requires "each PAX independently visible with individual status/documents/upload/validation/actions... do not force all PAX into one combined status."** The schema has `Booking.status` as a single enum with no per-passenger status dimension; `Document` does link to an individual `passengerId`, so per-passenger *documents* are genuinely tracked, but per-passenger *booking/processing status* is not — one booking has exactly one status for all its passengers. **CONFLICTING** with this named locked rule, though the document layer partially satisfies the spirit of it.

### 3.4 Payments

**BUILT**, with one significant conflict flagged separately in §7.7 (GST). Razorpay Payment Links integration, invoice PDF generation, mark-success manual override, webhook handling, and idempotency are all genuinely implemented and were verified end-to-end per CLAUDE.md's Phase 5A notes. This is one of the strongest areas of the build.

Gap versus spec: **CRM.md §19's exact 8-step payment-success sequence** (record payment → convert Lead→Booking → **retain Lead ID as Booking ID** → trigger workflow → trigger notification → generate invoice → mark coupon used → add timeline event) is mostly followed **except step 3**, which is structurally impossible today — see §7.2 below, the single biggest cross-cutting conflict in this report. Coupon-marked-used (step 7) also never happens, per §3.2 above.

### 3.5 Refunds

**PARTIALLY BUILT / CONFLICTING.** The refund calculator, status lifecycle (`PENDING → PROCESSING/REJECTED → COMPLETED`), and 0-floor clamp are real and were verified end-to-end. Two clear conflicts:
- **CRM.md §21: "Passenger-level partial refund... select individual passenger(s)... staff must NOT manually calculate final eligible refund."** The `Refund` model has no `passengerId` or list-of-passengers field at all — it's a flat `paidAmount/cancellationCharge/gatewayCharge/refundAmount` tied only to a `Payment`. **MISSING** — there is no way today to raise a refund against a specific subset of passengers on a multi-passenger booking; it's booking-wide only.
- **CRM.md §21: "CRM raises, Admin approves/rejects — CRM cannot approve its own refund."** `RefundStatusControl.tsx` + `PATCH /api/refunds/[id]/status` are gated only by `refunds.edit`, a permission that is granted to the default seeded **Staff** role (per Phase 4A's permission notes) — meaning ordinary CRM staff can walk a refund all the way to `COMPLETED` themselves with no distinct Admin-approval gate. **CONFLICTING** — this is a real financial-control gap, not a cosmetic one.
- Per-service refund-rule enforcement (₹250 OTB figure, Return Ticket's hard post-validation cutoff, Extension's Not-Accepted-vs-Rejected split, New Visa's 4-hour full-refund window) is covered in §7.4 below — none of it is enforced by this generic calculator today.

### 3.6 Documents

**PARTIALLY BUILT.** Upload/status/OCR pipeline for **passport** documents is genuinely strong (Phase 5D: MRZ checksum validation against the ICAO reference vector, staff review-and-confirm gate, never-auto-save-to-Passenger guarantee). But:
- **CRM.md §17 "Ticket OCR"** (extract Airline, Flight Number, PNR, Passenger, Departure/Arrival Airport+DateTime, Ticket Number, Baggage) and **§18 "Visa OCR"** (Passenger, Passport Number, Visa Number, Visa Type, Issue/Expiry Date, Validity) are both **MISSING** — only passport-photo OCR was built; there is no ticket-document or visa-PDF extraction pipeline, despite both being explicitly named, spec'd extraction targets.
- **Document status set** in the schema (`REQUIRED/MISSING/RECEIVED/VERIFIED/REJECTED`) matches CRM.md §16's stated set (`Pending, Uploaded, Validated, Rejected, Additional Documents Required`) closely enough in spirit, close enough to call **BUILT** on that specific point, modulo exact label wording.

### 3.7 Communications

**MISSING entirely.** CRM.md §25 describes a full Communication module (WhatsApp/Email/Notifications tabs, AI-assisted drafting across 10 draft types, a timeline of sent communications, never-auto-send-without-staff-action). Confirmed by direct grep: no `communication`/`inbox` concept exists anywhere in `src/`, no such nav item, no such screen. The WhatsApp bot (Phase 5C) sends/receives messages and logs them to `WhatsAppMessageLog`, and email sending exists (Phase 5B) — but **there is no CRM-facing UI to view, search, or draft from that transcript/log**, and no AI-assisted communication-drafting feature of any kind for staff use. This is a fully spec'd, fully missing module.

### 3.8 Task Engine

**MISSING entirely.** Confirmed by direct grep across `src/lib`, `src/components`, `src/app`: no `Task` model, no task-assignment UI, no auto-task-generation logic anywhere. Every one of the five service-specific MDs describes an auto-generated task list tied to specific triggers (missing docs, OCR mismatches, urgent-expiry windows, refund reviews, etc.) — none of this exists. The closest things in the schema (`AutomationReminderLog`, `AutomationRun`) are dedup/monitoring plumbing for the n8n jobs, not a staff-facing task/to-do system.

### 3.9 Status Engine

**PARTIALLY BUILT / CONFLICTING on the core architectural rule.** A real status engine does exist — `LeadStatus`/`BookingStatus`/`RefundStatus` are proper enums with explicit, validated transition maps (`src/lib/leads/transitions.ts`, `src/lib/bookings/transitions.ts`, `src/lib/refunds/transitions.ts`), all correctly audited and 409-on-invalid-transition. This is solid engineering.

But **CRM.md §14 is explicit and unambiguous: "every service has own status workflow; CRM must never use one universal status list."** The build does exactly the opposite by construction — one `LeadStatus` enum and one `BookingStatus` enum are shared across all six service types, with the same 6–7 named statuses regardless of whether the underlying service is New Visa, OTB, or Flight Special Fare, even though the client's own docs give each service a materially different named status pipeline (New Visa's 18-step internal list vs. OTB's grouped Booking/Verification/Airline/Exceptions list vs. Visa Change's single 19-step linear pipeline — these are structurally different shapes, not just relabeled). **CONFLICTING** — this is a foundational, named, locked architectural rule that the current schema violates by design, and retrofitting it later (moving from a shared enum to a per-service-configurable status table, per `ADMIN.md` §16–17's "Admin configures: available statuses, status transitions, workflow order... per service/sub-service") would be a real migration, not a small patch.

**Customer-safe vs. internal status split** — also explicitly required (`CRM.md` §14 example: internal "Applied to Embassy" → customer "Application submitted for processing"; `ADMIN.md` §45 lists "final customer-safe status mapping" as one of its own explicitly open items, so the exact mapping table is fairly treated as **NOT SPECIFIED / OPEN QUESTION** — but the *mechanism* to hold such a mapping at all is **MISSING**, since there's only one status field per entity today, not two.

### 3.10 Command Centre / Dashboard

**MISSING entirely.** Confirmed directly: `src/app/crm/(authenticated)/page.tsx` is a bare `redirect("/crm/leads")` — there is no dashboard route at all, let alone the KPI-rich home screen `CRM.md` §4 describes (Sales Overview KPIs, Operations Overview KPIs, period filter, "Most Action Required" queue). This is the single screen a staff member sees first on login, and it doesn't exist — staff land directly on the Leads table today.

### 3.11 Staff Assignment & Roster

**PARTIALLY BUILT / CONFLICTING.** Manual, one-at-a-time assignment exists and works (`LeadAssignmentControl.tsx`, `PATCH /api/leads/[id]/assign`, `GET /api/staff`). But `CRM.md` §34 and `ADMIN.md` §12 are both explicit and matching: **"normal CRM staff CANNOT assign/reassign/change roster/override assignment rules... Admin CAN."** The current assignment route is gated only by `leads.edit`, a permission granted to the default Staff role — meaning ordinary CRM staff **can** reassign leads today, which directly contradicts this locked rule. **CONFLICTING.**

Beyond that specific conflict, the following are **MISSING entirely**, confirmed by grep (`auto-assign`, `round-robin`, `load-balanc`, `workload`, `roster` — zero real hits anywhere in `src/`):
- Roster system (leave management, capacity)
- Automatic assignment / round-robin
- **The one locked, load-bearing rule given with a worked example** (`ADMIN.md` §13, Architecture Principle #13): *"Workload is based on number of PAX"* — a new booking should prefer the staff member with fewer total PAX across open bookings, not fewer bookings. No PAX-counting, no workload-balancing logic exists anywhere.
- Bulk reassignment (Admin selects POC → all open bookings → reassign)
- Staff leave → affected-work identification → recommended-replacement flow

### 3.12 Reports / Analytics / Delay Analysis (CRM.md §29–30)

**MISSING entirely.** No reporting screens, no Delay Analysis screen/model, exist anywhere in the CRM. There is no `delay`/`sla`/`escalation` concept found in the schema or `src/lib`. The Admin Data Export feature (§4.9 below) covers raw CSV extraction of four entities, which is a different thing from the KPI/analytics dashboards this section of CRM.md describes (Booking Analytics, Lead Conversion, Financial Reporting split public/internal, Refund Report, Staff Workload, Service Mix, Delay Analysis with average/longest-open-duration metrics). **MISSING.**

---

## 4. Admin

### 4.1 RBAC & Admin Auth

**BUILT**, one of the strongest areas of the whole build. Permission catalog, role/user CRUD, admin-lockout guard (can't strip the last `admin.full` holder), the `getStaffSession()` re-verification pattern, and section-level gating for `/admin/**` all match the spirit of `ADMIN.md` §4–5, §38 well, and were verified end-to-end including the negative cases.

Gaps versus the more granular spec:
- **`ADMIN.md` §44's action taxonomy** (`View, Create, Edit, Enable, Disable, Configure, Approve, Reject, Execute, Test, Publish, Export, View Sensitive Data`) — the actual permission catalog (`src/lib/auth/permissions.ts`) is a flat 16-entry list of `{module}.{view|edit}` strings plus a few standalone ones (`staff.manage`, `roles.manage`, `masters.manage`, `data.export`, `automation.view`). There is no structured `Module → Resource → Action` chain, and specifically no distinct "Approve" action (relevant directly to the refund-approval gap in §3.5) or "View Sensitive Data" action. **PARTIALLY BUILT** — a working, coarser permission system exists; the finer-grained action model described does not.
- **OTP/2FA** — `ADMIN.md` §5 explicitly says this is "removed for now," so its absence is correctly **NOT SPECIFIED / not a gap.**
- **Admin section all-or-nothing sidebar exposure** — already self-flagged in this project's own memory (`feedback_admin_section_all_or_nothing_gating.md`): granting any one Admin-only permission (e.g. `automation.view`) exposes the *entire* Admin sidebar to that role, not just the one screen the permission was meant to gate. **CONFLICTING** with the fine-grained-permission intent of the whole RBAC section, self-acknowledged as a known shortcut.

### 4.2 Masters — Airport, Airline, Border, DocumentRequirement, Vendor, PricingRule, Coupon, FAQ, NotificationTemplate, TaxFeeConfig

**BUILT**, confirmed by direct schema and route inspection — all ten masters have real CRUD (`/admin/airports`, `/admin/airlines`, `/admin/borders`, `/admin/document-requirements`, `/admin/vendors`, `/admin/pricing-rules`, `/admin/coupons`, `/admin/faqs`, `/admin/notification-templates`, `/admin/tax-fee`), gated by `masters.manage`, with enable/disable everywhere and a real delete only on FAQs (matching `CRM.md`/`ADMIN.md`'s "create/edit/enable/disable/delete" wording being FAQ-specific). This is genuinely one of the best-covered areas of the entire build relative to spec, with the caveats below.

Sub-item gaps:
- **`PricingRule` is a dead-end reference table** — confirmed by grep: no route outside its own Admin CRUD ever reads it. It doesn't feed the Quote Builder, doesn't compute a suggested `sellingPrice`, and isn't part of `CRM.md` §10's pricing formula anywhere in the actual write path. **PARTIALLY BUILT** — the master exists and is editable, but is functionally inert; ADMIN.md §19's formula (`Configured Service Amount + Additional − Fine − Coupon + Gateway = Payable`) is not actually driven by any admin-configured base price anywhere in the codebase — every quote is 100% staff-typed.
- **`Coupon.usageCount` never increments; no `couponType` distinguishing Employee/External/Abandoned-Quotation** (`CRM.md` §8, `ADMIN.md` §25) — the model has a generic `PERCENTAGE`/`FIXED_AMOUNT` type only. The named, numeric rule **"employee coupon max ₹500, Admin-configured"** has no corresponding cap field or enforcement anywhere. **MISSING.**
- **Country as an admin-manageable master** — `ADMIN.md` §14's dynamic `Country → Service → Sub-service → ...` hierarchy, with Admin able to add new countries without CRM core changes, does not exist. `GccCountry` is a fixed 8-value Prisma enum (`INDIA, UAE, SAUDI_ARABIA, BAHRAIN, KUWAIT, OMAN, QATAR, OTHER`), not an editable table. **CONFLICTING** with the explicit architecture principle (`ADMIN.md` §46 #7: "new countries/services shouldn't require CRM core redesign") — adding a 7th GCC destination today requires a Prisma migration and code changes, not an admin action.

### 4.3 Service & Country Architecture / Configurability

**CONFLICTING.** `ADMIN.md` §15 requires services to be "Add/Edit/Enable-disable"-able by Admin, with "a completely new service... architecturally configurable without changing the CRM core." `ServiceType` is a fixed 6-value Prisma enum (`NEW_VISA, VISA_EXTENSION, VISA_CHANGE, FLIGHT_SPECIAL_FARE, RETURN_TICKET, OTB`), hard-coded across dozens of files (schema conditionals in the Quote Builder, per-service lead-intake routes, per-service zod schemas, the WhatsApp bot's flow engine). This is a deliberate, reasonable engineering choice for a fixed, locked 6-service scope (`CLAUDE.md`'s own "Scope (locked)" section literally enumerates exactly these six modules) — but it is architecturally the opposite of what `ADMIN.md` asks for as a longer-term capability. **CONFLICTING with the letter of the admin-configurability requirement, though arguably consistent with the "scope is locked" instruction in CLAUDE.md** — this tension is worth a direct client conversation rather than a unilateral code decision either way.

### 4.4 AI Command Center

**MISSING entirely.** `ADMIN.md` §10, §41 describe a natural-language admin command console (understand → permission-check → validate → risk-assess → confirm → execute → audit) with ~28 example queries across both sections (P&L, "why is this booking stuck," failed automations, price changes, disable a service, etc.). Nothing resembling this exists — confirmed by grep, and the real Claude integration that does exist (WhatsApp bot's customer-facing intent detection, Phase 5C) is architecturally unrelated and not reusable as-is for this purpose (different permission model, different input surface, different risk profile — an admin command console executing real mutations needs its own confirm/audit layer, not a customer chat flow's).

### 4.5 Live Platform Monitoring

**MISSING entirely.** `ADMIN.md` §11, §36 describe live visitor/inquiry/WhatsApp-conversation/payment-activity feeds and integration health (Payment gateway, WhatsApp, Email, OCR, AI, n8n, APIs). The closest thing that exists is `AutomationRun` (Phase 5E, one row per n8n job invocation with SUCCESS/FAILURE + summary JSON) and its Admin screen (`/admin/automation` — confirmed to exist as a real functional page per the CRM/Admin screen inspection). That covers automation-job health only — **PARTIALLY BUILT** for that one narrow slice (n8n job monitoring), **MISSING** for everything else in this section (live visitor tracking, live WhatsApp conversation counts, payment-gateway/WhatsApp/Email/OCR connectivity health as a unified dashboard).

### 4.6 Global Search

**MISSING entirely.** `ADMIN.md` §9 wants a cross-entity search answering "show me everything about this booking" across booking/customer/PAX/payment/documents/OCR/staff/vendor/status/TAT/timeline. Confirmed directly: no search input exists anywhere in `CrmTopbar.tsx` or any Admin layout component, and no `/api/search`-style route exists anywhere in the route inventory. Not even a narrow version (e.g. "search by Booking ID") exists as a dedicated feature — the closest substitute is `LeadsTable`'s 300ms-debounced name/mobile filter, which is scoped to Leads only, not cross-entity.

### 4.7 Roster / Workload / Auto-Assignment

**MISSING entirely** — see §3.11 above for the full detail (this is the same gap, described from the CRM side; `ADMIN.md` §12–13 is where the Admin-side ownership of this capability is spec'd, and none of it — roster, leave, capacity, PAX-based auto-assignment, bulk reassignment — exists on the Admin side either).

### 4.8 Expense Management / P&L / Financial Reporting

**MISSING entirely.** `ADMIN.md` §28–29 wants an Admin-managed expense-category dropdown (15 named starter categories: Advertising, Salary, Domain, VPS/Hosting, AI, API, WhatsApp, Email, Software, OCR, Payment Gateway, Vendor, Office, Marketing, Operations, Other) feeding a P&L report, plus broader internal financial reporting (Sales, Revenue, Vendor Cost, Profit, Margin, Loss, Refunds, Gateway Charges, Coupons). Confirmed by direct grep (`expense`, `P&L`, `profit`): zero hits anywhere in `src/`. No `Expense` model exists in the schema. The only profit-adjacent figure anywhere in the app is `Quotation.margin` (per-quote, sellingPrice − vendorCost) — there is no aggregation of margin across bookings into any kind of P&L view, and no expense-tracking capability of any kind. **MISSING.**

### 4.9 Data Export

**PARTIALLY BUILT.** A real, working implementation exists (Phase 4D): four CSV export routes (`/api/admin/export/{customers,leads,bookings,payments}`), gated by a dedicated `data.export` permission (correctly kept separate from `masters.manage`, confirmed verified), streamed with correct `Content-Disposition`/`Content-Type` headers. This genuinely works and was verified end-to-end.

Relative to `ADMIN.md` §8/§43's much larger "Export Center" concept (one of 83 named admin screens, implicitly covering more than 4 entities — e.g. Refunds, Documents, Vendor performance, Staff workload are all reportable entities elsewhere in the spec with no corresponding export), this is a real but narrower slice of the full ask. **PARTIALLY BUILT** — correctly scoped and functioning for what it covers, not exhaustive.

### 4.10 Integrations Hub / Automation Monitor (Admin-side)

**PARTIALLY BUILT.** `ADMIN.md` §32–34 wants a generic `Provider → Configuration → Connection → Health → Usage → Errors → Logs → Test` model across every integration (WhatsApp, Email, OCR, Payment Gateway, Airline/Vendor APIs, AI providers, n8n). What exists is narrower and integration-specific rather than a unified provider-management screen: env-var-based provider selection (`isPlaceholder()` pattern) with no UI to view/test/reconfigure connection health per provider, plus the one genuine monitoring screen for n8n job runs (`/admin/automation`, §4.5 above). The Admin "Send Test" action on Notification Templates (Phase 5B/5C) is the closest thing to a per-integration "Test" action that exists, and it's scoped to email/WhatsApp template sends specifically, not general connection health-checking. **PARTIALLY BUILT.**

---

## 5. Automation

- **Quote expiry proactive sweep + `QUOTE_REMINDER`** — **BUILT** (`/api/automation/quote-expiry`, every 15 min per the n8n workflow JSON), verified end-to-end.
- **Payment follow-up / `PaymentStatus.EXPIRED`** — **BUILT** (`/api/automation/payment-followup`, hourly), the first code path ever to set this enum value, per CLAUDE.md's own note.
- **OTB requirement checks** — **PARTIALLY BUILT** — works, but self-flagged scope limitation: only reaches documents already attached to a `Booking` (misses passenger-only documents from initial intake), and cannot use the per-nationality `DocumentRequirement` checklist since OTB deliberately never captures nationality — works off whatever `Document` rows happen to exist instead of a real checklist.
- **Lead follow-up (`LEAD_FOLLOWUP`)** — **BUILT**, 3-day cooldown, recurring by design.
- **n8n workflow JSON files** — **PARTIALLY BUILT / NOT VERIFIED** — hand-authored against n8n's documented export schema, explicitly never live-imported into a running n8n instance in this environment. Functionally correct on paper, unconfirmed in practice.
- **The four workflows above are the entirety of automation** — none of the richer, service-specific automation implied by the client docs exists yet: Day-25 Extension re-extension reminder (`Visa_Extension.md` §22), document-retention/auto-delete after 3 months (`New_Visa.md` §27), OTB↔Return-Ticket cross-service gating (`CRM.md` §15), or any Task-Engine-driven automation (since the Task Engine itself doesn't exist, §3.8). **MISSING** for all of these.

---

## 6. Integrations

- **Payment Gateway (Razorpay)** — **BUILT**, Payment Links API, real webhook HMAC verification, swappable mock-gateway fallback exercising the identical signature scheme. One genuine architectural judgment call (Payment Links vs. Orders+Checkout.js, documented and justified) given there's no live customer checkout yet.
- **Email (Resend)** — **BUILT**, 7 of 8 catalog events wired to real triggers (only `QUOTE_REMINDER` was missing a trigger — now closed by the n8n automation in Phase 5E), template rendering, audited outcomes (`EMAIL_SENT`/`EMAIL_SKIPPED`/`EMAIL_FAILED`), console fallback for dev.
- **WhatsApp Cloud API** — **PARTIALLY BUILT.** The service-layer plumbing (session vs. template messages, signature verification, console fallback) is real and matches the same pattern as the other two integrations. But the client-facing menu-driven experience described in the service MDs (`New_Visa.md` §4: admin-configurable greeting-menu buttons — UAE Visa/Flights/OTB/Return Ticket/Track Booking/Other) does not exist — the actual bot is a free-form intent-classification conversation (Claude or keyword fallback), not a button-menu flow. Both approaches are legitimate, but they are **not what the spec describes**, and the specific "admin can add/remove/rename/reorder menu buttons; disabled services must not appear in the menu" control has no equivalent — there's no menu to configure. **PARTIALLY BUILT / diverges from spec's stated UX shape**, worth a direct call on whether free-form-AI-first is an acceptable substitute for the client.
- **OCR (Passport)** — **BUILT**, genuinely rigorous (ICAO checksum validation against the canonical test vector, staff confirm-before-write gate). See §3.6 above for the two OCR types (Ticket, Visa) that remain **MISSING**.
- **n8n** — see §5 above.

---

## 7. Cross-Cutting Business Rules

### 7.1 Protection Plan

**MISSING entirely**, and worth stating plainly since it's a named, priced, revenue-relevant feature: `New_Visa.md` §8–9 specifies a per-passenger ₹5,000 default (admin-configurable) add-on with mandatory T&C acceptance, eligibility gating, and a 14-status lifecycle shown alongside the visa status. Nothing in the schema (`Passenger`, `Quotation`, `Booking` — checked all three) has any field for this. No revenue line, no eligibility check, no purchase flow exists anywhere.

### 7.2 Lead-ID-becomes-Booking-ID

**CONFLICTING — this is the single most consequential structural gap in the report.** `CRM.md` §5, §7, §19 (and repeated at #2 in the "Important business rules" list, §39) are unambiguous: *"Lead ID generated immediately; on successful payment, Lead ID becomes Booking ID — do NOT generate a second unrelated Booking ID."* The built schema does the opposite by design: `Lead.id` and `Booking.id` are two entirely separate cuid primary keys, and `Booking.bookingId` (the human-readable `TNX-XX-XXXXXX` reference) is generated from a random placeholder at booking-creation time and only assigned its real value at payment success — **explicitly documented in this project's own memory (`project_booking_id_placeholder_pattern.md`) as "unrelated to the row's own id."** There is no code path anywhere that reuses the Lead's identifier as the Booking's identifier; a new, independent identifier is generated every time, which is precisely the thing the client's rule forbids.

There is a third identifier scheme in the mix too: the customer-facing **Lead reference** (`formatLeadReference`, e.g. `OTB-JYOQHX`, derived from the last 6 characters of `Lead.id`) is yet another distinct format from `Booking.bookingId`. So today there are **three** different ID schemes in play (Lead's own cuid, the derived Lead reference string, and the independently-generated Booking reference string) where the client's spec wants **one continuous identifier** that simply changes state from "Lead" to "Booking" without ever becoming a new number. Fixing this is a real schema/reference-format decision, not a one-line patch — flagged as a high-priority item for the punch list below.

*(Minor, self-resolving note: `New_Visa.md`'s own example format is `TNX-######` with no service-code segment, while `Visa_Change.md`'s example is `TNX-VC-XXXXXX` with one — the two client docs are mutually inconsistent on this point; the codebase's actual format follows the more specific Visa Change example. Not a codebase defect, just worth flagging back to the client docs.)*

### 7.3 Per-Service Status Engines + Customer-Safe Mapping

**CONFLICTING** — fully detailed in §3.9 above. One universal `LeadStatus`/`BookingStatus` enum set exists where the spec requires per-service configurability; no customer-safe-vs-internal status split exists at all.

### 7.4 Per-Service Refund/Cancellation Rules

**PARTIALLY BUILT / CONFLICTING**, with the generic mechanism (`computeRefundAmount`) real and correct in isolation but none of the per-service business rules layered on top of it:

| Service | Client-specified rule | Codebase today |
|---|---|---|
| OTB | ₹250 deduction after doc validation; no refund after airline processing | `SAMPLE_OTB_FIXED_SERVICE_CHARGE = 500` (wrong figure) + no "after airline processing" hard block — **CONFLICTING** |
| New Visa | Full refund minus gateway within 4h of payment; ₹250 after doc validation; no refund after embassy submission | None of these three tiers/windows exist — **MISSING** |
| Visa Extension | Not Accepted → refund minus gateway; Rejected → no refund (two different outcomes) | Single generic `REJECTED` status, no outcome-type distinction — **CONFLICTING** |
| Visa Change | Not specified in `Visa_Change.md` itself | Generic calculator applies — **NOT SPECIFIED / no conflict** |
| Return Ticket | Hard no-refund cutoff once forwarded to vendor (no partial tier at all, unlike others) | Generic calculator applies unconditionally, no post-forwarding block — **CONFLICTING** |
| Flight Special Fare | Cancellation = paid minus vendor/gateway charges (from `Flight_Special_Fare.md` §12) | Generic calculator is compatible in shape — **BUILT-ish**, closest match of the six |

Also **MISSING** across every service: `CRM.md` §21's passenger-level partial-refund selection (§3.5 above) and the Admin-approves/CRM-cannot-self-approve control (also §3.5).

### 7.5 Document Retention/Reuse Rules

**MISSING.** The ≤3-month reuse-with-confirmation / >3-month request-new rule (`New_Visa.md` §17–18, `Visa_Extension.md` §15–16) has no age-checking logic anywhere in the document pipeline — `Document.createdAt` exists as a timestamp, but nothing reads it to drive a reuse-or-replace prompt. The 3-month post-processing auto-delete-except-Passport-Front-and-Visa-PDF rule (`New_Visa.md` §27) has no corresponding purge job among the four built n8n automations. Visa Change and Return Ticket don't specify an exact retention window in their own docs (correctly **NOT SPECIFIED** there), but do reference generic "reuse existing documents" — which also isn't implemented as an active reuse-prompt flow anywhere in the customer-facing forms (none exist for these two services yet regardless, per §2.3/§2.5).

### 7.6 Paid-Booking Config Snapshots

**PARTIALLY BUILT, mostly by accident of data-model shape rather than deliberate design.** `ADMIN.md` §19, §40, and §46 (#11) all lock in the same rule: admin config changes apply immediately to new work, but a **paid** booking must retain the pricing/config it was committed under, even if the admin later changes rates or document checklists.

What actually protects a paid booking today: `Quotation.sellingPrice`/`vendorCost`/`margin` and `Payment.gstAmount`/`gatewayFee` are all **stored, computed-once columns**, not live-recalculated from `TaxFeeConfig`/`PricingRule` on every read — confirmed directly (`PricingRule` is never read outside its own Admin CRUD route; `getTaxFeeRates()` is called only once, at Payment-creation time). So pricing/tax/gateway-fee figures are, in effect, snapshotted — but this is an emergent property of "we store computed values instead of formulas," not a deliberately-named "config snapshot" feature, and it does **not** extend to:
- **Document checklist changes** — `DocumentRequirement` is a live, current-state table; nothing freezes "the checklist this booking was created against" onto the `Booking`/`Lead` row, so an admin editing a nationality's document list today could retroactively change what an already-paid booking's staff/customer sees as required. **MISSING** for this specific dimension.
- **Any explicit `configSnapshot` JSON field or version-stamping mechanism** — confirmed absent from both `Quotation` and `Booking`. If the client wants this documented and guaranteed rather than incidental, it needs a deliberate implementation (e.g. a snapshot JSON column written at booking-creation time), not just "the current columns happen to not re-read live config."

### 7.7 GST / Invoice

**CONFLICTING — high-priority, concrete finding.** `ADMIN.md` §27 and `CRM.md` §20 both state plainly: **"Current: GST OFF, invoice non-GST"** — GST is a future, admin-enable-when-ready feature, and the invoice breakdown should show Service amount / Service charge / Coupon discount / Gateway charge / Grand total, with **no GST line today**. The built system does the opposite: `TaxFeeConfig` is seeded at a live **5% GST rate**, every payment computes and stores a real `gstAmount`, and the invoice PDF (`src/lib/invoices/render-invoice.ts`) explicitly renders a "Base Fare / GST / Gateway Fee / Total" breakdown with GST always present. **This means the app is currently charging and invoicing GST that, per the client's own locked spec, should be off by default.** This is a live, financially-material conflict, not a cosmetic one — flagged as a top punch-list item.

### 7.8 Coupons

**MISSING / PARTIALLY BUILT** — see §3.2 and §4.2 above. `Coupon` exists as editable Admin reference data with correct-shaped validation (percentage-vs-fixed, date-ordering, duplicate-code rejection), but is never actually applied to any quote/payment, `usageCount` never increments, there's no `usageLimit` enforcement in practice, no distinction between Employee/External/Abandoned-Quotation coupon types, and the specific locked **₹500 employee-coupon cap** has no corresponding field or check anywhere.

---

## 8. Deployment / Process Governance

This section could not be fully sourced from `TRIPNEXIO_MASTER_BLUEPRINT_v2.md` or `00_Project_Overview.md` — a direct re-read of both files (in full, this round) found **no Git branch-naming/workflow section, no staging-environment requirement, no backup-frequency/retention rule, and no explicit numbered "7-point requirements" list** anywhere in either document. If such a list exists, it must live in `message.txt` or the Upwork PDF transcript rather than these two governing docs — **flagging this as a genuine sourcing gap in this audit round rather than asserting facts this pass couldn't verify.**

What the Master Blueprint **does** specify, confirmed verbatim:
- **§28 (verbatim)**: *"Before major coding, Claude Code should inspect frontend, backend, routes, controllers, services, Prisma schema, PostgreSQL structure, existing APIs, pages, components, master data and documentation... No code changes. No database changes. No migrations. No deletion."* — this report is that process, run now rather than before the last several build phases. **Process gap**: per §1 above, this audit is arriving after Phases 3–5 were already built, not before them as the Blueprint's own sequencing intends.
- **§26 "Development Safety Rules"** (18 items, process rules for Claude Code specifically — not Git/staging/backup): never reset the database, never run `migrate reset`, inspect before changing, don't hard-code airports/airlines, keep customer-facing statuses simple vs. detailed internal ones, validate payments server-side, run Prisma/TypeScript checks after changes, "if a rule is missing, create an OPEN QUESTION instead of guessing." Largely **BUILT/followed** as an operating discipline based on the CLAUDE.md build log's own verification notes throughout (tsc/lint/build after each unit, incremental phased commits, explicit SAMPLE-data labeling).
- **§20 "Database Safety"**: never reset, never delete existing tables/data — **followed**, confirmed by the prisma-dev-shadow-DB-drift workaround pattern (diff+manual-apply+resolve, rather than a reset) documented in this project's own memory.

**Git/staging/backup governance itself remains genuinely unaudited this round** — recommend a direct follow-up read of `message.txt`/the Upwork PDF specifically for this, since the parent task's framing ("the client's 7-point requirements") implies it exists somewhere and this pass's two targeted files didn't contain it.

---

## 9. Prioritized Punch List

Ordered by apparent business criticality per the locked docs — not a timeline, not an estimate.

1. **Resolve the phase-order violation before doing anything else.** Per §1, essentially all of Phases 2–5 (CRM, Admin, Payments, WhatsApp, OCR, Automation) were built before the client ever saw or approved a finished website, contradicting the Blueprint's own explicit gate. The highest-leverage next step is getting the client to actually look at and approve the current website direction (even retroactively), because every website gap below compounds this risk — building 4 more service frontends without that checkpoint repeats the same mistake at larger scale.
2. **Turn off GST by default** (§7.7) — this is a live, financially-material conflict with an explicit "GST OFF" locked rule; low effort (change the `TaxFeeConfig` seed + confirm the invoice template conditionally omits the line at 0%), high risk if left as-is since it affects every real payment.
3. **Fix the OTB refund figure (₹500 → ₹250)** and, more importantly, **build the actual per-service refund rule engine** (§7.4) — right now a single generic calculator is silently exposed to five services with materially different, sometimes hard-cutoff (Return Ticket), sometimes time-windowed (New Visa's 4-hour rule) locked refund policies. The Return Ticket "no refund once forwarded" rule in particular is a real liability if refunds are processed against that service before this is fixed.
4. **Close the refund/lead-assignment approval-authority gaps** (§3.5, §3.11) — CRM staff can currently self-approve refunds and self-reassign leads, both directly contradicting explicit "Admin-only" locked rules. This is a permissions/gating fix, not a new feature, and is comparatively cheap to close.
5. **Resolve the Lead-ID-becomes-Booking-ID identifier architecture** (§7.2) — this is a foundational data-model decision that gets more expensive to unwind the longer more bookings/payments/invoices are created under the current three-ID scheme. Worth a deliberate design conversation with the client now rather than a later migration.
6. **Build the missing 4 customer-facing service frontends** (Visa Extension, Visa Change, Flight Special Fare, Return Verified Ticket) — the backend/API layer already exists for all four; this is the highest-visible remaining gap for anyone outside the engineering team looking at the product, and ties directly back to punch-list item #1.
7. **Build the CRM Command Centre / dashboard** — currently the first screen a staff member should see doesn't exist at all (bare redirect to Leads); this is explicitly the most-detailed single screen spec in `CRM.md` and currently the most conspicuously absent.
8. **Implement the Protection Plan** (§7.1) — a fully-specified, priced, revenue-bearing feature with zero implementation across the entire schema and API surface.
9. **Build the Task Engine and Communications module** (§3.7, §3.8) — both are described in exhaustive, trigger-by-trigger detail across every service MD and CRM.md, and neither has any code today; these are the operational backbone the client's own docs assume staff are using day-to-day.
10. **Implement per-service status engines + customer-safe status mapping** (§7.3) — a deep architectural change (single shared enum → per-service configurable status tables), best tackled deliberately rather than patched incrementally, and blocks the customer-safe-status-mapping deliverable the client explicitly wants everywhere status is shown to a customer.
11. **Implement PAX-based staff workload/roster/auto-assignment** (§3.11/§4.7) — a named, worked-example, locked rule (`ADMIN.md` §13) with zero implementation.
12. **Build Global Search, Live Monitoring, and the AI Command Center** (§4.4–4.6) — large, genuinely valuable Admin capabilities, but reasonably lower priority than the customer-facing and financial-control items above since they're internal productivity tools rather than correctness/compliance risks.
13. **Build Expense Management / P&L reporting** (§4.8) — no implementation exists; lower urgency than the above unless the client is actively trying to run real financial reporting off this system today.
