# Audit: 6 New "Developer Handover" Documents vs. Locked Specs vs. Current Build

**Date:** 2026-09-20
**Source documents:** `docs/TripNexio_New_Visa_Short_Developer_Handover_v2.docx`, `docs/TripNexio_OTB_Service_Developer_Handover (1).docx`, `docs/TripNexio_Return_Ticket_Developer_Handover.docx`, `docs/TripNexio_Special_Fare_Developer_Handover.docx`, `docs/TripNexio_Visa_Change_Developer_Handover.docx`, `docs/TripNexio_Visa_Extension_Updated_Developer_Handover.docx`

**Purpose:** The client sent 6 new per-service "Developer Handover" documents. Each was compared against (a) the original locked spec in `client-message/*.md` and (b) the actual current codebase, to identify what's genuinely new, what's a build gap, and what directly conflicts with an already-locked decision. No code has been changed as part of this audit — see `DEVELOPMENT_ROADMAP.md` for how these findings turn into build steps.

---

## Cross-cutting themes (appear in most/all 6 documents)

1. **Multi-applicant / Primary+Secondary pattern.** New Visa, OTB, Return Ticket, Visa Change, and Visa Extension all now describe a Primary Applicant (full contact details) + Secondary Applicants (reduced fields, no mobile/email) pattern. Only Visa Change and Flight Special Fare already have real multi-passenger support today; the rest are single-passenger.
2. **Documents-before-Lead-submission.** Visa Extension and Visa Change explicitly require applicant-wise document upload to happen *before* a Lead is created, reversing the current pattern (Lead first, staff/CRM collects documents after).
3. **Status-list conflicts.** Every one of the 6 new documents proposes a shorter or differently-worded CRM status list than what's already seeded in `prisma/seed-service-statuses.ts` (built and reviewed earlier as "Step 19"). None of the 6 new lists is a superset of what's already seeded — these are real conflicts requiring a client decision, not additive changes.
4. **Admin-configured pricing engines.** New Visa, Visa Change, Return Ticket, and OTB all describe pricing that should auto-calculate from Admin-configured rules (nationality/age-tier/country/airline). The `PricingRule` model exists (Phase 4C) but is not wired into any actual quote-calculation code anywhere — staff still enters `sellingPrice` manually everywhere.

---

## New Visa

**New/changed vs. `New_Visa.md`:**
- Adds an **Occupation** field per traveller (not in the original spec).
- Passport Number now collected **at intake** (original spec collected it later, at document upload/OCR).
- Automatic price recalculation on every applicant/option change is now explicit UI behavior.
- Minor/guardian rule reframed as a blocking modal at form-fill time (original only required it be enforced before payment).
- New 10-item status list is a condensed, differently-worded subset of the original's 13 customer-facing + ~18 CRM-detailed statuses.

**Current implementation gap:**
- `src/lib/validation/new-visa-schema.ts` has no per-traveller array — only a single name/email/mobile + a numeric `travelers` count. No `occupation`, no per-traveller passport/DOB, no Add/Remove Applicant UI.
- No minor/DOB-based logic anywhere — no age classification, no parent/guardian fields, no blocking prompt.
- Document upload is a single optional passport image, not per-applicant.
- No dedicated New Visa status catalog — only the generic `LeadStatus`/`BookingStatus` enums.
- `PricingRule` rows exist (seeded) but nothing reads them to auto-price a quote.

**Suggested roadmap steps:**
1. Rework New Visa into a per-traveller array (name, passport number, DOB, occupation) with Add/Remove Applicant.
2. Add DOB-based minor detection with a blocking parent/guardian sub-form (client + server enforced).
3. Build a real pricing-calculation function reading `PricingRule`, and reconcile the two competing status lists before implementing.

---

## OTB

**New/changed vs. `OTB.md`:**
- Original spec treats OTB strictly as an **upsell/add-on** after a New Visa/flight/existing-customer interaction, with an "existing customer reuses passport/visa" branch and a hard rule "do not build a generic eligibility check." The new doc reframes OTB as a **standalone service card with its own multi-applicant form**, dropping the existing-customer-reuse branch entirely.
- New hard block: if Urgent processing can't meet the timeline, prevent the booking outright (original only said "show whichever of Normal/Urgent is actually available").
- Return-Ticket cross-sell now includes a Lead-capture-only fallback path not in the original.
- "Starting from ₹700" example pricing display is new UI guidance.

**Current implementation gap:**
- `src/lib/validation/otb-schema.ts` is single-passenger only; no Add/Remove Applicant anywhere.
- `processingType` is a free customer choice with **zero travel-date-vs-timeline validation** — `Airline.otbRequired/normalPrice/urgentPrice` already exist as admin masters data but nothing reads them.
- No Return Ticket cross-sell integration exists anywhere.
- No post-payment document-upload step in the current OTB flow.
- Seeded 19-status catalog already exactly matches `OTB.md` §18 — the new doc's 8-status list conflicts with the *existing seeded catalog*, not the original spec.

**Suggested roadmap steps:**
1. Add multi-applicant (Primary + Secondary) support to OTB.
2. Wire `Airline.otbRequired/normalPrice/urgentPrice` + travel date into a real availability/pricing check, with the hard-block UX for infeasible Urgent cases.
3. Build the post-payment Return-Ticket cross-sell + Lead-capture fallback; reconcile the status-list conflict with the client first.

---

## Return Verified Ticket

**⚠️ Direct contradiction, not just a gap:** the original locked spec fixes this service as **UAE-only** (§3, §32 rule 3), and the current schema's own code comment documents that `destinationCountry` was deliberately removed per that lock. The new handover doc reintroduces a multi-country destination list (UAE, Oman, Qatar, Thailand, Vietnam, Malaysia, Singapore...) — this reverses a deliberate, audit-driven decision rather than extending it.

**Other new/changed vs. `Return_Verified_Ticket.md`:**
- Passport Number added as a required field (original spec reused existing customer records instead).
- Visa-validity options expanded to 30/60/**90** days (original locks only 30/60).
- Named Primary/Secondary multi-applicant replaces the original's simple passenger-count field.
- New 4-status list is a drastic simplification of the original's 13-step lifecycle + 6 exception statuses, and **doesn't mention the locked "no refund after forwarding" cutoff** (§16, §32 rule 20) at all.

**Current implementation gap:**
- `src/lib/validation/return-ticket-schema.ts` correctly implements the *original* UAE-only lock — it would need to be rebuilt, not extended, to match the new doc.
- No named-applicant array anywhere — only a numeric `travelers` count.
- No Return-Ticket-specific status catalog exists in the schema (uses generic `LeadStatus`/`BookingStatus`).
- No "no refund after forwarding" cutoff logic exists in the refund calculator.

**Suggested roadmap steps:**
1. **Client clarification required first:** is Return Ticket staying UAE-only (locked spec) or genuinely expanding to multi-country (new doc)? This blocks all schema work on this service.
2. Once resolved: add named Primary/Secondary applicant support.
3. Cross-cutting: decide whether to build real per-service status catalogs to replace the generic Lead/Booking enums (both docs assume granular statuses that don't exist as a queryable field today).

---

## Flight Special Fare

**⚠️ Scope conflict flag:** CLAUDE.md's locked market scope is explicitly "India to UAE/GCC only." The new doc's "Important Update" section asks for a full Indian-domestic + arbitrary-international airport database (Thailand/Vietnam/Malaysia/Singapore also reappear here, same as in the Return Ticket doc) — this goes beyond the locked scope, and at the scale of a full airport dataset (likely thousands of rows) it also collides with Hard Rule #1 (never invent/import authoritative domain data without client review) far more seriously than the existing handful of sample airport rows.

**Other new/changed vs. `Flight_Special_Fare.md`:**
- Original spec already scoped Phase 1 narrowly ("major Indian airports with direct India→UAE flights" + GCC airports); the new doc broadens this to full Domestic + International with a searchable, admin-manageable dropdown (name/city/code/country).
- Passenger age-category calc (Adult 12+/Child 2–11/Infant <2) and "don't ask full passenger details upfront" are **unchanged** from the original — not new.

**Current implementation gap:**
- `Airport` model is a small GCC/India-focused reference table with no bulk-import mechanism.
- `Quotation.route` and the lead schema's `origin`/`destination` are free-text strings, not `Airport` id references — no dropdown wiring exists.
- Age-category calc (`computePaxType()`) and multi-passenger support (up to 9) are **already implemented** — not gaps.
- No status catalog matches either the original's 16-status list or the new doc's 5-step flow.

**Suggested roadmap steps:**
1. **Confirm with client first:** does Special Fare's market scope now extend beyond India–GCC, and what's the authoritative airport-data source (e.g. a licensed feed) and who maintains it going forward? This blocks everything else here.
2. Once confirmed: import the approved dataset into `Airport`, then convert `origin`/`destination`/`route` to id references with a searchable dropdown.
3. Reconcile Special Fare's status handling (pick one authoritative list, don't keep drifting).

---

## Visa Change

**New/changed vs. `Visa_Change.md`:**
- Original spec is airport/border-focused: the customer never types airport/border names — staff selects from the Admin Airport/Border Master *after* the lead exists, and pricing only appears once availability is confirmed. The new doc omits this operational model entirely — no A2A/border-specific flow, no "confirm availability before pricing" step.
- New doc's "multiple itineraries per lead" (simultaneous alternative offers) and nationality/adult/child rate *configuration* are new framings — the original already had nationality/adult/child pricing (§17), but as passenger-wise multiplication, not a rate-config table.
- Applicant-wise document upload **before** Lead submission contradicts the original (checklist shown before availability, actual upload happens **after payment**).
- New 10-item status list is a much shorter, different set than the original's 20-item flow.

**Current implementation gap:**
- A full frontend + API already exist and already support multiple passengers (`additionalPassengers[]`) matching the *original* spec's pattern — this is further along than the other services.
- No document-upload step exists in this flow at all yet (before or after lead).
- `Quotation` has no A2A/border operational fields and no nationality/age-tier pricing dimension — uses the generic `feeAmount + fineOrCharges` shape.
- No "multiple simultaneous itineraries per lead" concept exists — the current select-one-expires-others quotation model assumes one active offer at a time.
- Seeded 20-status catalog already implements the *original* spec's flow — genuinely conflicts with the new doc's 10-status list.

**Suggested roadmap steps:**
1. Add applicant-wise document upload before Lead submission (reuse the `PassportUploadField` pattern from Phase 5D).
2. Extend `Quotation` with nationality/adult/child rate breakdown fields, and reconcile the two conflicting status lists with the client.
3. **Needs client input:** does "multiple itineraries" mean simultaneous alternative offers (extend `alternativeOfId` to Visa Change)? This is a design decision, not just a build task.

---

## Visa Extension

**New/changed vs. `Visa_Extension.md`:**
- Core flow (basic form → Lead with no payment → staff validation → quotation → payment → Booking ID) matches the locked spec's shape, but the new 5-status list is a drastic simplification of the locked spec's 20-item lifecycle (which distinguishes Not-Accepted vs. Rejected refund treatment) — a real conflict.
- **Genuinely new:** per-applicant document upload before Lead submission, and multi-applicant support — the locked spec is explicitly single-passenger throughout.
- **Not new — already exists, and more rigorously:** the "check passport against existing TripNexio records" requirement. This is exactly what the locked spec's §2/§25 eligibility rule already describes, and `checkVisaExtensionEligibility()` (`src/lib/leads/visa-extension-eligibility.ts`) already implements it server-side, gating Lead creation itself. The new doc's framing ("staff can check, auto-fetch historical details") describes *displaying* this existing lookup to staff, not a new capability.

**Current implementation gap:**
- A real frontend exists but is single-applicant only, with **zero document-upload UI**.
- `visaExtensionRequestSchema` has no multi-applicant array or document-upload fields (passportNumber is already required, matching the new doc).
- No staff-facing UI surfaces the eligibility match's historical visa details — `checkVisaExtensionEligibility` returns a match but nothing displays it in the CRM today.
- Seeded 20-status catalog conflicts with the new doc's 5-status list.

**Suggested roadmap steps:**
1. Add multi-applicant support + per-applicant document upload before Lead submission (mirrors Visa Change's needed change).
2. Surface `checkVisaExtensionEligibility`'s match (including matched lead's visa/quotation history) in a staff-facing panel on `LeadDetail.tsx`.
3. Confirm with client whether the new 5-status list replaces or supplements the locked 20-status lifecycle before touching the seed catalog.

---

## Decisions needed from the client before building (blocking items)

1. **Return Ticket**: UAE-only (locked) vs. multi-country (new doc) — direct contradiction.
2. **Special Fare**: India–GCC only (locked market scope) vs. full domestic+international airport database (new doc) — scope expansion + real data-sourcing question.
3. **Every service**: which status list is authoritative — the already-seeded catalogs (`prisma/seed-service-statuses.ts`, reviewed as Step 19) or the new, shorter lists in these 6 documents?
4. **Visa Change**: does "multiple itineraries per lead" mean simultaneous alternative offers shown to the customer, or sequential staff-prepared options (current one-active-at-a-time model)?
