# Docs audit — 23 Oct 2026 (pending list)

Client asked (23 Oct): "ek bar docs ke according go through kar lijiye, bahut pending lag raha hai".
Audited against: client docs 05/09/14/15/20 Oct, the 14 handover / page-content docx in `docs/`, `ADMIN.md`, `CRM.md`,
the chat log (`message.txt`) and the 21 Oct screenshots. Code-level audit (read-only); items marked LIVE need a check on tripnexio.com.
Tick `[x]` as each item is fixed.

## P0 — blocks launch

- [x] **No scheduler on the VPS.** Root crontab empty, no n8n container, 0 Coolify scheduled tasks (checked 23 Oct). Schedules exist only in
      `vercel.json` (Vercel is no longer production). So quote-expiry, SF 10-min reminders, payment/document reminders, lead follow-up,
      staff-alerts (travel 24 h → task + On Hold), SLA escalation, retention, RT auto-complete have never run live.
      Done 23 Oct: 11 Coolify scheduled tasks (n8n cadence: quote-expiry 5 min, payment/coupons/staff-alerts hourly, SLA :15, daily jobs).
      `lead-followup` left off (client doc 20 Oct removed Follow-up Due) — confirm with the client.
- [ ] **New Visa lead with no way to pay** (items 1–3 fixed 23 Oct; a destination with no price at all stays Price on Request) (client: "lead ban rahi hai, payment option nahi"):
  - [x] Website offers a processing type when *either* Adult or Child is priced (`StepVisaDetails.tsx:122` `offered()`); an unpriced pax type → `computeNewVisaPrice` null → lead without link. Offer only when every traveller's type is priced; block submit otherwise.
  - [x] Bot prices ADULT only and, if nothing is priced, offers every type (`whatsapp-bot/flows.ts:465-476`). Price with real adult/child counts; never offer an unpriced type.
  - [x] Manual lead shows **Infants** for New Visa (`ManualLeadForm.tsx:404`) → INFANT has no price. Hide (or map to Child); make nationality + visa option required when they exist.
  - [ ] `new-visa/destinations.ts:12-16` treats a country with only a published page (no active product/price) as live → listed but never payable. Require an active product.
  - [ ] Without a link, `LEAD_RECEIVED` still sends "Complete Payment" whose button falls back to an empty page (`status-template.ts:391`).
  - [ ] Adult/Child age differs: website 12+ = Adult (`pax-type.ts`), bot asks 18+ (`flows.ts:324`). Pick one.
- [x] **Partial refund doesn't move status.** `REFUND_PARTIALLY_COMPLETED` is fired (`finalize-refund.ts:75`) but no status carries that event (catalog `refundTail`, migration `20261021090000` seeds "Partially Cancelled" with `systemEvent NULL`). Set it on "Partially Cancelled" for every service (catalog + migration).
- [x] **Special Fare passenger collapse (11026FL080, 1A+1C+1I → 1 Adult).** Bot was fixed; website path `findOrCreatePassengers` (`create-lead.ts:119-163`) merges same-name / same-passport travellers within a submission and never refreshes `paxType`/`dob` on a reused row. Never merge inside one submission; refresh type/dob on reuse.

## P1 — doc requirements not (fully) done

Special Fare / Return Ticket / OTB
- [x] SF quote validity optional → quote can never expire / stays payable (`quotation-schema.ts:12`, `validity-cap.ts:25`). Required for SF, default now+30 min, clamp 30.
- [x] SF Confirm Availability → Sent to Airlines without checking Govt ID documents validated (`post-payment.ts:163`). Add the same block as `vendorChoiceBlock`.
- [ ] SF "Seat Unavailable" (SF_27) never entered by the system (`post-payment.ts:210-245`).
- [x] SF Paid + Final Confirmation sent together → invoice attached twice (`engine.ts:336`).
- [x] SF alternative form still has "Reporting time" (`SpecialFareAlternativeForm.tsx:116`); doc: same fields as main form.
- [ ] Legacy lead-followup job still sends `LEAD_FOLLOWUP` (doc: "Follow-up Due and its templates removed") (`automation/lead-followup/route.ts:81-104`).
- [x] RT "Deliver to customer" still offers Reservation + Ticket; picking Ticket doesn't move to Ticket Issued (`output-types.ts:41`). One output "Return Verified Ticket".
- [ ] RT panel "Save vendor / PNR" reposts the old vendorCost (NaN when null) (`ReturnTicketActionsPanel.tsx:56-60,117-122`). Look up the rate server-side.
- [ ] RT/OTB website request: client template `RVT_NEW` / `OTB_01_NEW` has "Track Status" button and no pax/destination/date (14/15 Oct asked Pay Now + trip summary). Regression since status templates.

New Visa / Visa Extension / Visa Change
- [x] New Visa document checklist falls back to hard-coded "India" nationality (`required-documents.ts:63,90`) instead of the lead's.
- [ ] Bot: no DOB / guardian step for under-18 (handover §5).
- [ ] Bot: no expected approval date / prices shown (item 10).
- [x] VC bot: upload link after the lead and nationality per passenger (fixed 23 Oct). (`engine.ts:302` covers VE only).
- [x] VE "previously received a visa" accepts any converted New Visa booking, and falls back to cancelled/refunded bookings unfiltered (`visa-extension-eligibility.ts:99-133`) — the "WRONG RECORD FOUND" case.
- [x] VE landing page step 01 says "entry date" (`visa-extension/page.tsx:42`, `site-content/pages.ts:94`); doc: visa expiry date, step titles per doc.
- [ ] VE option/price cards on the landing page (VE handover §1) — missing.
- [ ] New Visa Admin Timelines tab still shows the generic service card above per-country timelines (`ServiceTimelinesManager.tsx:288`).
- [x] New Visa hero secondary button "Track Status" → doc "Track Application".

CRM / Admin
- [x] Staff password login + failed logins not audited (`api/crm/auth/login/route.ts`).
- [x] WhatsApp chat: no "End chat / hand back to bot"; handed-off number stays silent until customer types menu.
- [x] Passport auto-extract upload accepts JPG/PNG only (`PassportExtractionReview.tsx:36`); doc: PDF too.
- [x] Enquiry closed/resolved email can go with an empty remark (note required only for complaints).
- [ ] Passenger outcome sets booking COMPLETED bypassing the status engine (`passengers/[passengerId]/outcome/route.ts:84`).
- [ ] Coupons can't be limited to services (Admin handover §17).
- [ ] Refund approval limits (§17) — none.
- [ ] Per-service action permissions (edit OTB, view New Visa) (§1) — only per-user service scope exists.
- [ ] Vendor ↔ sub-service link (§12) — missing.
- [ ] Timelines by country for RT/VE/VC/SF (§6, chat 28-Sep) — only New Visa (country) and OTB (airline).
- [ ] Bulk apply for pricing/timelines (§3) — documents only.
- [ ] Report filters by sub-service / status / payment status (§15); cash-flow report has no filters.
- [ ] Full-form SF/VE/VC show in both Leads and Quotations (Dashboard §7: Quotations instead of Leads).
- [ ] Pagination missing: Document Master, Vendor Service Rates, Visa Master, Sub-services, Processing types, Roles.
- [x] 21 Oct screenshot: booking "All statuses" popover is covered by the Tasks card (z-index); booking Communications shows the customer's unrelated New Visa chat (popover fixed; the chat came from overlapping test requests — cleared by the 23 Oct reset).

Copy / templates
- [x] "vendor" still in customer copy: `flight-special-fare/landing/AlternativeAndPaymentSections.tsx:92`, `TicketingSections.tsx:34,41,54`, `return-ticket/steps/Step3Summary.tsx:63`, `legal/default-pages.ts` (Terms §4/5/7, Privacy §4, Refund, Disclaimer).
- [x] SF landing still lists "Ticket number / PNR / vendor reference / Ticket issue time" (`TicketingSections.tsx:51-60`); doc: PNR only.
- [x] RT request page meta says "Share your visa type" (`return-ticket/request/page.tsx:7`); RT FAQ #2 typo "return or return ticket" (needs a migration).
- [ ] Brand line "Travel Made Easy" vs OTB/RT docs "Travel Made Simple" (`site-config.ts:6`, `email/get-sender.ts:33`).
- [ ] Status labels: New Visa "Visa Application Approved" shown as "Visa Approved"; "Cancelled and Refunded" shown as "Booking Cancelled — Refund Completed" in every service (catalog.ts:84,91,135,175,212,245,292).
- [ ] Customer rejection text can fall back to `BookingPassenger.outcomeNote` (internal audit reason) (`status-template.ts:292`).
- [ ] No dedupe / retry / template version on status messages; "User Not Responding" has no frequency cap.
- [ ] `VC_VISA_APPROVED` email body has WhatsApp wording; package email closing misses "Have a safe and pleasant journey with TripNexio!" (`output-notes.ts:30`).
- [ ] 121 WhatsApp templates have no `metaTemplateName` → all skipped outside 24 h until Meta approves and names are filled in Admin.

## Needs the client

"Travel after 24 hrs" = travel date already passed by 24 h (built) or travel within 24 h?
VE / OTB "Cancelled and Refunded": send a message or not (docs contradict themselves)?
Status matrix vs per-status sections disagree in ~15 labels (VC/VE/OTB/RT) — code follows the per-status sections; confirm.
Do the final page docs override the 05 Oct "4 steps on every service" (SF 7, RT 5, VC 7 in docs)?
Invoice serial: "TNS/A02601" (extra 0) or "TNS/A2601" (built)?
Child age: 2–12 (SF handover) / under 12 (website) / under 18 (bot, minor rule)?
Website Pages: hero-level editing enough, or every body section editable?
Pre-payment Booking row for New Visa (same ID as lead) acceptable?

## LIVE checks (data / visual)

- Oman missing in bot → is Oman's product active in Admin?
- Thailand + Etihad rate on Pricing Dashboard; prod `companyWhatsapp` value.
- VE "unable to draft/send quotation" (likely staff visa verification block), VC "unable to save/share itinerary".
- Filter rows / one-line layouts on Bookings, Payments, Invoices, Refunds, Documents, Tasks, Follow-ups; mobile hero buttons.
