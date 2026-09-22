# Audit: 3 New Docs (23 Sep 2026) — Final Answers, Admin FINAL Handover, Internal Dashboard Merged

**Date:** 2026-09-23
**Source documents:** `docs/TripNexio_Developer_Answers_Final_Questions.docx`, `docs/TripNexio_Admin_FINAL_Developer_Handover_All_Corrections.docx`, `docs/TripNexio_Internal_Dashboard_All_Requirements_Merged.docx`, plus the "new messages from client 23-sep-2026" section appended to `client-message/message.txt` (already implemented in the previous session — see `HANDOVER_UPDATES_AUDIT.md`'s H6a/H5/H4/airports work).

**Purpose:** These 3 documents are much larger in scope than the earlier 6 service-handover docs — two of them (`Admin FINAL`, `Internal Dashboard Merged`) are near-complete redesigns of the Admin panel and CRM, not incremental additions. This is a read-only audit, structured by size/risk, so the next work can be sequenced deliberately rather than one-shot — per `CLAUDE.md` hard rule #2.

---

## Tier 1 — Small, concrete, already-actionable (`Developer Answers Final Questions`)

These are direct answers to specific questions already asked, each a tightly-scoped fix:

1. **OTB Urgent = 8 working *hours*, not days.** Current `src/lib/otb/processing-rules.ts` only has day-granularity (`workingDaysUntil`). A same-day or next-day request needs an hour-level check to correctly offer/deny Urgent — this is a real gap, not just a config value change.
2. **New Visa guardian relationship: Father/Mother only.** Remove "Legal Guardian" from `GUARDIAN_RELATIONSHIPS` in `src/lib/validation/new-visa-schema.ts` (I'd flagged this as my own addition needing confirmation — now confirmed to remove).
3. **Visa Extension and Visa Change also need Visa Copy before Lead submission**, not just Passport copy (H1/H3 from the previous session only collected a passport copy per applicant). Needs a second required upload per applicant on both flows.
4. **New Visa's payment timing changes structurally**: *Basic form → Lead → **Payment** → Booking → Documents* — this is the same "pay right after the form" pattern already built for Return Ticket/OTB (H7), **not** the quote-review-and-approve pattern built for New Visa in H8. This is a real pivot, not an addition — New Visa needs to move off H8's flow onto something like H7's `createAutoCheckout`, which needs a real New Visa pricing config (country + visa type, Admin-managed) to compute the price automatically. The existing `PricingRule` model (serviceType/paxType/nationality/basePrice) was built in Phase 4C specifically for this kind of wiring but was never connected to anything — this is the moment to do it.
5. **Visa Extension, Visa Change, Special Fare stay on the quote-review-and-pay flow (H8)** — explicitly confirmed, no change needed there.
6. Return Ticket: visa validity (30/60/90) does **not** affect the rate — already how H6a was built, no change needed.

---

## Tier 2 — Admin panel consolidation (`Admin FINAL Developer Handover`)

The document's own core rule: *"Do not create duplicate master data or separate configuration screens where one common control can serve multiple services."* Several things it asks for are already true; several are real, sizeable gaps.

**Already satisfied, no work needed:**
- One shared Airport master (built in H6b) — already used by Special Fare and Visa Change's A2A flow.
- Audit trail on every mutation, RBAC with service-agnostic permissions, CSV export for customers/leads/bookings/payments.
- Admin/CRM auth already fully separate systems.

**Real gaps, verified against current code:**
- **Airline master isn't actually shared** — `Airline` is only wired into OTB. Return Ticket and Special Fare's schemas have no Airline reference at all (confirmed: no `Airline` import in either).
- **Vendor model is minimal** — `name/service/active` only (confirmed in schema). No POC, GST/payment details, and a vendor is tied to exactly one `ServiceType`, not many as the doc asks ("one vendor linked to multiple services").
- **Staff Leave has no approval workflow** — `StaffLeave` (confirmed in schema) is just `startDate/endDate/reason`, no `status`/approver/approval-date. It already excludes staff from auto-assignment (Phase 6), but there's no approve/reject step at all.
- **No service-wise staff permissions** — today's RBAC permissions (`leads.view`, `leads.edit`, etc.) are the same across every service; there's no "this staff member can only act on OTB and Return Ticket leads" concept.
- **Pricing, Documents, and Timeline are NOT one central control each** — they're separate today: `PricingRule` (unused, see Tier 1 #4), `DocumentRequirement` (nationality+serviceType, no country/adult-child dimension), and OTB's own `OtbRuleConfig` (OTB-only, no equivalent for other services' SLA).
- **No Invoice Builder** — only a fixed `pdfkit`-generated tax invoice exists (Phase 5A), no Proforma option, no Admin-configurable company/bank/signatory details.
- **No System Configuration screen** (company info, branding, currency, timezone, retention, backup, maintenance mode) — these live scattered across env vars and hard-coded `site-config.ts`, not one Admin screen.
- **Admin sidebar is a flat list**, not the grouped dropdowns (People & Access, Service Configuration, etc.) the doc asks for — currently ~25 flat items in `adminNavItems`.

---

## Tier 3 — CRM → "Internal Dashboard" overhaul (`Internal Dashboard Merged`)

This is the largest of the three documents — effectively a CRM UX redesign, not additions to the existing one.

**Real gaps, verified:**
- **Rebrand**: employee-facing UI should say "Internal Dashboard," not "CRM" — currently every label says CRM.
- **New login page** with Admin/Team-Member type selector, Google login, Forgot Password — today's `/crm/login` is a single plain email/password form, no Google option, no password reset flow anywhere.
- **Lead status list doesn't match**: current `LeadStatus` enum is `NEW/CONTACTED/QUALIFIED/QUOTED/CONVERTED/ON_HOLD/LOST` (7 values); the doc's suggested list is `New/Contacted/Follow-up Required/Customer Responded/Qualified/Quotation Created/Quotation Accepted/Payment Pending/Converted/Lost/Closed` (11 values) — a real enum change, cross-cutting (touches every status-transition map, seed data, CRM badge components).
- **No Manual/Offline Lead entry form** for staff (phone-in customers) — every lead today is created only by a customer's own website/WhatsApp submission.
- **No "Extra Payment Collection"** against an existing booking — today's payment flow only ever creates one payment tied to a booking's selected quotation; there's no "charge this booking again for an add-on" path.
- **Command Centre isn't action-based** — the existing `/crm` dashboard (Phase 3A) shows counts; it doesn't have the specific KPI groupings asked for (Sales Overview / Operations Overview / Most Action Required) with each card linking to a pre-filtered list.
- **No date-range filter + CSV export on every major section** — some list screens have filters, but not the specific Last-7/30/90-days + custom-range pattern everywhere.
- **No staff-composed email from the CRM** — all email today is system-triggered (`notifyCustomer()` on specific events); there's no "staff writes a free-form email to this customer" feature, let alone AI-assisted drafting for email or WhatsApp.
- **"Unassigned" bucket removal / roster-based display** — today unassigned leads just show `assignedStaff: null`; the doc wants inactive-employee-owned records to visibly say "Unassigned" while still showing who it was assigned to.

**Already substantially satisfied:**
- Customer 360 (Phase 3B) already shows passengers/leads/bookings/quotations/payments/documents/timeline in one place — the doc's ask here is mostly "make sure this stays intact," not new.
- Document upload by staff-on-behalf-of-customer already exists (`AddDocumentForm`); customer's own upload exists for Return Ticket/OTB (H7) but not the other 4 services yet.
- Coupons, FAQs, Refunds, Tasks, Payment Link Generation already exist as separate screens — the ask is mainly to surface them as dashboard shortcuts, not build them from scratch.

---

## Why this can't be a "build it all" step

Between Tiers 2 and 3 alone this is realistically 15-20 separate, non-trivial build steps (staff-leave approval workflow, service-wise permissions, one pricing/document/timeline engine consolidating what's currently 3+ separate systems, a lead-status enum migration touching every status transition, a new login page, an offline-lead form, extra-payment collection, an invoice builder, AI-assisted staff email/WhatsApp composition, a redesigned action-based dashboard, and more) — each with its own schema changes, API routes, and UI. Per `CLAUDE.md` hard rule #2 ("work incrementally... do not one-shot dozens of pages/endpoints"), this needs to be sequenced and reviewed step by step, the same way the original 31-step roadmap and the 6-doc handover work were.
