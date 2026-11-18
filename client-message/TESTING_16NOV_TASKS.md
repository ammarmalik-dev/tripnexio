# Client doc 16 Nov 2026 — task checklist

Source: `client-message/new-doc-from-client-16-nov/TripNexio Project.docx` (its first page holds live credentials — never commit it, never copy values out of it except into env vars).
The doc ends with the **final status lists** for Visa / Visa Change / Visa Extension / Flight / Return Ticket / OTB (§S below) — these replace the 20 Oct lists in `src/lib/service-status/catalog.ts` + `template-catalog.json`.

Status 16 Nov: unit 1 (broken bugs) deployed 16 Nov (commit 71440b0, backup pre-deploy-20261116T154612, migration 20261116120000 applied) — F3, K11, J13, M3, H10 ticked; I3 partly (see note); M1 confirmed: all 136 active WhatsApp templates lack a Meta template name (90 website messages skipped in 30 days) — client must get templates approved and enter the names in Admin; A9 moved to the Special Fare unit. Questions for the client are in §Q — don't build those items until answered.

## Q. Questions for the client (conflicts / unclear in the doc)
- [ ] Q1 (unit 2a followed the doc's own status list: internal "Quotation Accepted"; confirm if "Quotation Selected" / "Package Selected" wording is still wanted anywhere) "Quotation Approved" is renamed to **Quotation Selected** in one place and **Package Selected** in another (Visa Change?), while the status list uses **Quotation Accepted**. Which label where?
- [ ] Q2 Quotation statuses: "Sent, Selected, Unpaid, Expired" vs "Selected, Accepted, Expired". Final list?
- [ ] Q3 Return Ticket On Hold message says "issue 12 hours before departure"; the 25 Oct rule was "day before travel". Is it now 12 h?
- [ ] Q4 Return Ticket pricing "Within 20 Days / After 20 Days": 20 days counted from what (travel date → return date)?
- [ ] Q5 Cancellation quotation: is the service charge per passenger or per booking? GST only on the service charge?
- [ ] Q6 OTB "Additional Documents Received / Submitted" are marked "To Configure" — what triggers them?
- [ ] Q7 Coupon accounting: "expense category in P&L considered as sale amount which is paid" — record the discount as an expense with gross sale, or net sale?
- [ ] Q8 Gateway fee by payment method (Card/UPI/Net Banking): Razorpay payment links don't let us pick the method upfront — fee is known only after payment. OK to apply it from the webhook's method?
- [ ] Q9 Removing Admin → Data Export: confirm every export it offered exists on the individual pages first.
- [ ] Q10 Bookings 11026FL112 / FL113 log review: production data — OK to read prod audit logs?
- [ ] Q11 I11 says coupons only for New Visa / OTB / Return Ticket, but N9.2 sends unpaid-quotation coupons for Visa Change / Flight / Visa Extension. Which is right? (Today each coupon has its own service list in Admin.)

## A. Special Fare (flight)
- [ ] A1 Manual lead: origin city, destination city, return date (round trip)
- [ ] A2 Send multiple quotations in one click (Special Fare + Visa Change only)
- [x] A3 Email heading: no airline logo of the first quotation — unit 6: email heading shows only the SELECTED flight airline (no logo while several options are open)
- [ ] A4 Ticket upload: reuse baggage from the quotation, don't ask again
- [ ] A5 Partial ticket issuance → status Partially Issued (CRM + website)
- [ ] A6 Ticket upload: compare ticket details with passenger data; block on mismatch
- [ ] A7 Offline flight lead: Country + Service Type shown in CRM after quotation
- [ ] A8 Flight notifications: city names (Bengaluru → Delhi), not codes; PAX count
- [ ] A9 One-Way / Round-Trip shown with both dates and cities; round-trip quotation (FL113 lost its return date)
- [ ] A10 "Quotation Selected" email: subject / heading / message per doc; selected flight details (airline, flight no., cities, dates, times, PAX) in email, WhatsApp and payment link
- [ ] A11 Seat unavailable: never auto-refund or auto-send alternative; customer chooses Request Refund / Approve Alternative; refund held until choice; extra payment link or balance refund; quotation status updated
- [ ] A12 Ticket cancellation flow (post-issuance only): Ticket Cancellation Requested → Sent to Airlines for Cancellation → Cancellation Quotation (airline fee + admin service charge + GST, company profit to MIS) → customer approval → refund of the remainder → Ticket Cancelled
- [ ] A13 Cancellation request not allowed before ticket issuance (use normal refund flow)
- [ ] A14 Airline Reschedule (accept / refund, new ticket upload) and Airline Cancellation (full refund); P&L updated
- [ ] A15 Travel date auto-updated when the customer accepts a flight option

## B. Return Ticket
- [ ] B1 Travel > 24 h away → task + On Hold + automatic customer message (wording per doc; see Q3)
- [ ] B2 Pricing: Within 20 Days / After 20 Days categories, vendor rates for each, calendar split, auto price (see Q4)
- [x] B3 Country not repeated in Service Details — unit 6: Return Ticket service details no longer repeat the country (it has its own column)
- [ ] B4 From OTB: don't ask return ticket again at upload; destination auto-selected with price — unit 6: the WhatsApp bot uses the OTB country for the added Return Ticket (not asked again). Website upload step still open

## C. OTB
- [x] C1 Rejected only after Sent to Airlines — checked: OTB Rejected only after Sent to Airlines (engine)
- [x] C2 Additional Documents Sent to Airline only when documents were requested (from Document Master) and uploaded — unit 2b: OTB additional documents only after Sent to Airlines and from the Document Master
- [ ] C3 Manual lead: active countries + live airlines only, calendar rules, configured documents auto-fetched (staff upload or notify)
- [x] C4 No staff refund after OTB approved — checked: OTB Application Approved blocks refunds (blocksRefund); only an Admin override can refund
- [x] C5 WhatsApp bot offers Return Ticket in the OTB flow — unit 6: bot OTB flow asks about a return ticket and can add a Return Verified Ticket (same country + passengers, return date asked), with its own pay link, bookings linked. Not run end-to-end locally (no OTB prices seeded)
- [ ] C6 Airline Decision per passenger (Approved / Rejected / Pending)
- [x] C7 Website abandoned leads captured for OTB — unit 6: the website draft is saved on Continue as soon as name/mobile/email are filled, even when country / airline / date still block the step; filled trip details (country, airline, travel date, processing) are kept on the draft lead

## D. Visa Change
- [ ] D1 Before payment ask only the Visa Copy; after payment never re-ask visa/passport; configured docs after payment
- [ ] D2 Package: staff upload the real package documents (no generated PDF); "Visa Change Package", only after payment
- [ ] D3 Pre-payment website status wrong (no Cancelled / On Hold on a processed booking)
- [ ] D4 Partial visa upload in CRM
- [ ] D5 Manual lead: no travel date; Exit Method (A2A / Border) + Nationality → document checklist; offline lead shows configured documents — unit 6: manual lead no longer asks a travel date for Visa Change. Exit Method + Nationality → checklist still open
- [ ] D6 Travel date = actual exit date (A2A + Border); shown when creating the bus itinerary
- [x] D7 Proforma: "Fine" (not "Fine / Status-Change Charges"); service fee = configured fee not profit; tax invoice includes the fine — unit 4: line reads Fine; configured fee is the service charge (not profit); the tax invoice has the Fine line too
- [x] D8 Second form page message: "Our team will verify each applicant's visa details before sending your quotation." — unit 6: shown at the top of the Visa Change details step

## E. Visa Extension
- [x] E1 Mixed PAX (one TripNexio visa, one external) — allow extension for eligible passengers — unit 6: mixed travellers — the extension goes ahead when at least one passenger has a TripNexio visa; the others are named for staff to review (bot already did this)
- [ ] E2 Quotations only for eligible passengers
- [x] E3 Calendar: don't block past dates (Visa Change + Extension) — unit 6: CRM manual lead visa expiry accepts past dates (website forms already did)
- [x] E4 Proforma: service charge per Admin config, profit separate — unit 4: same rule — configured service charge, profit stays internal
- [x] E5 Bot: ask total PAX only; fix "TripNexio Visa Not Found" — unit 6: bot asks one passenger count for Visa Extension; passport match ignores spaces / dashes (a false Visa Not Found)
- [ ] E6 Manual lead: no travel date; passport number per passenger; configured documents auto-fetched — unit 6: manual lead no longer asks a travel date for Visa Extension. Passport per passenger + auto documents still open
- [ ] E7 No Applied to Embassy before document validation; validated documents not re-requested; download visa/passport copies; reject before expiry date + quotation
- [ ] E8 Workflow: Documents Validated → Expiry Date → Quotation → Payment → Applied → Approved/Rejected; Approved needs Visa PDF; no approval notification before PDF; no direct refund after approval
- [x] E9 Travel date = applied date — unit 2b: the Applied Date is the Visa Extension travel date (G8)

## F. New Visa
- [ ] F1 Page 1 after visa selection: name, mobile, email, first applicant (saved for abandoned follow-up); page 2: applicants (name, DOB, passport expiry, occupation)
- [ ] F2 Under-18 parent/guardian requirement per country (Admin setting)
- [x] F3 Fix "Invalid option: expected one of FATHER|MOTHER" — unit 1: empty hidden value accepted, minors still must choose
- [x] F4 Booking summary: Visa Fee / Service Charge / Total separately — unit 6: New Visa summary shows Visa Fee and the configured Service Charge on separate lines, then GST, gateway fee, total
- [x] F5 Workflow validation (backend + UI): document actions only on real uploads; additional docs / visa upload / rejection only after Applied; approval needs Visa PDF; no Hold after approval — unit 2b: document actions need an uploaded file, additional docs / visa upload / rejection only after Applied, approval needs the visa PDF, no hold after approval
- [ ] F6 After applied: request only the Visa Copy, not a package
- [ ] F7 Visa Type column shows Tourist / Transit / Any (not "New Visa"); service details: stay, entry (validity only if enabled)
- [ ] F8 Visa Validity: hidden everywhere customer/staff-facing; country-wise Admin toggle (off by default)
- [ ] F9 Pricing form: one form per visa product with all nationality × Adult/Child × Normal/Express prices; filters; remove the separate New Visa button
- [ ] F10 Nationality-wise document configuration; document descriptions everywhere (website, bot, CRM)
- [ ] F11 Service-specific nationalities (only enabled ones, no "All Nationalities")

## G. Status engine & workflow (all services)
- [ ] G1 Replace status lists with §S; remove old statuses (incl. filters/templates); Admin can delete; status config per Service × Country with the workflow shown
- [x] G2 Take Action button per booking showing only valid actions for service + stage (enforced in backend) — unit 2b: Take Action button per row in the bookings list (only the server-allowed moves; reason / panel steps open the booking)
- [x] G3 Hold only before external processing; no Hold after delivery — unit 2a: hold / not responding only before Applied to Embassy / Sent to Airlines (engine pauseAfterHandover, list + server)
- [x] G4 Additional documents: select documents from Document Master + passengers, one notification; upload → Under Review → validate → resubmit → decision; no visa upload before/under Additional Documents Required — unit 2b: documents picked from the Document Master (staff /api/document-types), several passengers + one message, only after Applied / Sent to Airlines, never cancelled passengers; upload -> Additional Documents Submitted -> Validated checked
- [x] G5 Additional Documents Validated only when actually requested + uploaded + validated — unit 2b: additional-document statuses only after the hand-over (VC after Package Generated no longer jumps)
- [x] G6 Embassy Decision per passenger (Approved / Rejected with reason / Pending); Partially Approved only if ≥1 approved — unit 2b: per-passenger decision only after Applied / Sent; visa Approved only with that passenger visa PDF; Partially Approved needs >=1 approved; Cancelled only via refund
- [x] G7 Vendor name required when forwarding to embassy — checked: New Visa asks the vendor at Applied to Embassy; Visa Change / Extension take it from the quotation (2026-10-15 I7)
- [x] G8 Processing (applied) date captured for every service; travel-date rules per service — unit 2b: hand-over records the processing date for every service; Visa Extension travel date = applied date; Visa Change = A2A exit flight date
- [x] G9 Visa Delivered / Rejected / Additional Docs hidden before Applied — checked by the engine (skipsHandover) + unit 2b passenger rule
- [x] G10 Document upload UX: Uploaded / Replace while under review / Validated (locked) / Rejected (replace); OCR review = single Confirm / Reject — unit 2b: pay page shows Uploaded (under review, Replace) / Validated (locked) / Rejected (reason, Upload again) + descriptions; server refuses replacing a validated document
- [x] G11 Website status mapping fixes (Submitted for Processing shown too early; pre-payment statuses) — unit 2b: Track shows the lead own steps before payment (Quotation Ready / Payment Pending) and the service steps while on hold (no generic Submitted for Processing)
- [x] G12 Admin override: no automatic notifications; other validations stay for regular staff — unit 2b: Admin override sends no customer message
- [x] G13 Payment cannot be marked completed without real receipt — checked: payment completes only via gateway check / approved bank transfer; unit 2b blocks any status (even Admin override) saying Paid without a received payment

## H. Cancellation, refunds & partial cancellation (all services)
- [x] H1 No direct Cancel / Approve / Refund buttons on bookings; only Initiate Refund (booking section) — unit 3: no direct cancel on bookings — cancellation only via Initiate Refund (status + passenger Cancelled are refund-only; Admin may override)
- [ ] H2 Approved refund → passengers Cancelled everywhere; passenger count, quotations, documents, actions only for active passengers — unit 3: approved partial refund marks its passengers Cancelled (existing); documents / uploads only for active passengers. Passenger count + quotations for remaining passengers still open (J / A units)
- [x] H3 Cancelled booking: block every action (issue, deliver, hold, package, payment status, document requests) — unit 3: every service action route refuses a cancelled booking (bookingActionBlock)
- [x] H4 Refund Pending: block package / ticket / delivery — unit 3: same block while a refund is open (pending / at the gateway)
- [x] H5 Refund rejected → booking back to its previous status; resume for passengers not refunded; amount editable + resubmit — unit 3: rejected refund puts the booking back on its previous status; a rejected refund can be corrected (amount) and sent again
- [x] H6 Refund amount from each passenger's actual fare (Adult/Child), editable, total ≤ collected; show collected per selected passenger — unit 3: per-passenger fare share (existing) + staff may enter the total; never above what was collected
- [x] H7 Approver: Approve / Reject only; approval sends to gateway automatically (or bank-transfer record); gateway refund ID only; one customer notification — unit 3: approver has Approve / Reject only; approval sends to the gateway; completion only from the gateway; only the gateway refund ID is shown
- [x] H8 Bank-transfer bookings: manual refund (transaction no., date, amount, status), never via gateway — unit 3: bank-transfer refunds approved with transaction number + date (completes it), never through the gateway
- [x] H9 Refund table columns (Created By, POC, Service, Type, Method, Collected) + filters — unit 3: refunds list shows Service, Type, Method, Collected, Created By, POC; filters Service / POC / Type / Method / Status / Date
- [x] H10 Track Refund button opens the refund page — unit 1: refund status section on the booking page
- [ ] H11 Revenue / GST reduced by cancelled amounts; invoice regenerated for remaining passengers; cancellation template names each cancelled passenger — unit 4: finance reports deduct completed refunds from revenue (ex their GST / gateway-fee share); management GST liability net of refunded GST. Invoice regeneration for remaining passengers after a partial cancellation still open
- [x] H12 After ticket issue / sent to airlines (flight) or OTB approved / visa approved: no direct refund — service cancellation flow only — unit 3: Special Fare Sent to Airlines / Ticket Issued block direct refunds (OTB / visa approvals already did); Admin override stays
- [ ] H13 Log review of 11026FL112 (actions after cancellation) — see Q10

## I. Payments, invoices & coupons
- [x] I1 Offline Bank Transfer in CRM; slip upload; lead stays pending until approver verifies; offline payment records table; switch method before payment — unit 4: switch an unpaid payment online link <-> bank transfer (link cancelled at the gateway first); bank transfer stays pending until the approver verifies the slip (existing maker-checker)
- [x] I2 Online / Offline choice after quotation acceptance (VC / VE / Flight): bank details, receipt upload, Payment Verification Pending, ops blocked until approved — unit 4: VC / VE / Special Fare pay page offers bank transfer (Admin bank details from Invoice Settings), customer uploads the receipt, approver verifies before the booking is active
- [x] I3 (unit 1 did: manual-lead link now sent when the lead is past its first status; link + Copy + Resend stay on the lead after creation. Left for the payments unit: switch to Bank Transfer while a gateway link is pending — needs gateway link cancel) Copy Payment Link fixed; manual-lead payment link delivered (email + WhatsApp) and visible; Offline button stays — unit 1 + 4: link sent / copied / resent from the lead; Offline option via Switch to bank transfer
- [x] I4 Booking ID + Lead Code passed to the gateway (visible in its dashboard) — unit 4: gateway notes carry booking_id + lead_code
- [x] I5 Payment link hidden after payment (show Paid) — unit 4: Copy Payment Link only while a payment is pending
- [x] I6 Payment confirmation email + WhatsApp with Upload Documents button — unit 4: payment confirmation email + WhatsApp button = Upload Documents (migration 20261116180000)
- [x] I7 Invoice: PAX count only (no "-1" quantity); invoice edit with vendor name + cost → booking + P&L; separate Invoice Edit permission; audit old/new values — unit 4: separate invoices.edit permission; invoice edit sets vendor + vendor cost (selected quotation, so booking + P&L follow); audit keeps old and new values
- [x] I8 Proforma: only configured service charge + GST — unit 4: proforma shows the configured service charge (Admin → Services) + GST, the rest as the Govt./Vendor/Airline fee
- [ ] I9 Gateway fees per method; actual vs configured fee in invoice edit; P&L from net received (see Q8) — unit 4: actual amount collected + actual gateway fee recorded on the invoice edit. Gateway fee rates per payment method (Card / UPI / Net Banking) + P&L from net received still open (see Q8)
- [x] I10 Vendor / sponsor Credit / Paid tracking with outstanding balances — unit 4: booking records the amount paid to the vendor / sponsor, date and transaction ref (finance.manage, audited); Credit until it reaches the vendor cost, then Paid; Vendor Payments report shows Paid + Outstanding per vendor
- [ ] I11 Coupons: create from Manual Lead (amount, auto code, applied); New Visa / OTB / Return Ticket only; checkout coupon field; tracking (creator, user, date, POC, used/unused, expiry) in one line; P&L accounting (see Q7) — unit 4: customer coupon field on the payment page (NV / OTB / RT; link renewed for the discounted total); coupon tracking: creator, last use (customer, booking, date, POC), Used / Unused / Expired filter; staff coupons from the Manual Lead flow already exist. Service restriction is per coupon (Admin) because N9.2 also sends coupons for VC / Flight / VE — see Q11. P&L coupon accounting waits on Q7
- [ ] I12 Manual lead for NV / OTB / RT only when pricing is configured; extra charges under Vendor/Airline Fee — unit 4: NV / OTB / RT manual leads refused until their price is configured. Extra charges under Vendor/Airline fee still open
- [x] I13 Extra charges included in Sales Price in P&L — checked: extra payments add revenue in the P&L (finance reports) and extra charges are part of the selling price

## J. Leads, quotations & sales/ops separation
- [x] J1 Lead statuses: New, Contacted, Interested, Under Review, User Not Responding (notifies), Unqualified, Converted (auto after paid); follow-up date until converted/unqualified; temperature unchanged — unit 5: lead lists New / User Not Responding (only one that notifies) / Contacted / Interested / Under Review (VC, VE keep their own review step) / Converted (payment) / Unqualified; lead On Hold + Cancelled gone; follow-up date + note on the lead, Follow-ups lists the due ones (migrations 20261117120000, 20261117130000). VC / VE / SF keep Quotation + Payment Pending steps per the final status list
- [ ] J2 Unpaid / abandoned: selecting a quote or reaching the pay page keeps the record in Leads (Unpaid / Payment Abandoned); Booking only after payment (+ approval)
- [ ] J3 Quotations only for SF / VC / VE; payment status shown separately; filters Service / Country / Status / Payment; validity from Admin; quotation history stays in Quotations
- [ ] J4 Separate histories: Lead / Quotation / Booking, no cross-booking mixing
- [x] J5 Assignment: NV / OTB / RT → Sales POC before payment, Ops after; Flight / VC / VE → Ops; abandoned leads auto-assigned to Sales; manual leads by Super Admin re-assigned after payment; fair round-robin / workload (1-1-1-1) — unit 5: staff Team (Sales / Operations / both, Admin → Staff, migration 20261117140000); NV / OTB / RT leads + abandoned drafts go to Sales, SF / VC / VE to Operations; paid NV / OTB / RT handed to an Operations POC; assignment by fewest open leads (1-1-1-1), then PAX. Needs Auto-assign ON + teams set in Admin
- [x] J6 Permissions: Sales vs Operations; separate View All Bookings vs action permission — unit 5: new bookings.viewAll permission (migration 20261117150000) = see every lead / quotation / booking, act only on own (viewing never grants actions). Sales vs Operations rights are role config in Admin → Roles: Sales role without documents.edit / bookings.edit, Operations role without leads.edit
- [x] J7 Task auto-assignment by responsibility (sales vs ops) — unit 5: every system task is assigned to its lead / booking POC (Sales before payment, Operations after); on the hand-over to Operations the open tasks move with the lead
- [ ] J8 Sales Overview: Converted Leads instead of Qualified; Sales vs Ops dashboard cards/filters per doc — unit 5: Command Centre shows Converted Leads instead of Qualified. Sales / Ops split of cards + filters still open
- [ ] J9 Admin Sales Tracker: targets per POC, metrics, filters
- [x] J10 Entry Source filter (Website / WhatsApp / Manual) on Leads, Quotations, Bookings — unit 5: Entry Source filter (Website / WhatsApp / Manual) on Leads, Quotations and Bookings — Manual = staff-created (details.manualEntry), WhatsApp = bot, Website = the rest; also via ?entrySource=
- [ ] J11 Manual lead: edit instead of separate Add Passenger
- [x] J12 WhatsApp bot abandoned leads for every service — unit 6: once the bot has the name + email (or knows the customer) an abandoned draft lead is created for that service (draftChannel WhatsApp, Sales auto-assign) and refreshed with each answer (country / airline / date / processing); the finished request takes the same lead over
- [x] J13 Reference IDs like Q-6UOFRN → configured serial format; "Booking" instead of "Application ID" — unit 1: quotation reference + proforma number = lead serial (11026VC105-Q2)

## K. CRM / Admin UI
- [x] K1 Sticky logo + sidebar; only content scrolls (CRM + Admin) — unit 6: CRM + Admin shell is the screen height; logo + sidebar and top bar stay, only the main content scrolls
- [ ] K2 Compact list pages: filters ≤ 2 rows, full width, ≥ 10 rows visible, Express highlight only (no "Normal"), PAX inline — Leads, Quotations, Bookings, Payments, Invoices, Refunds, Tasks
- [x] K3 POC name column + filter: Tasks, Follow-ups, Documents, Refunds, Invoices, Payments — unit 7: shared PocFilterSelect; POC column + filter on Tasks (assignee), Payments (+ CSV export), Invoices, Documents (document lead, else booking lead); Follow-ups and Refunds already had both
- [ ] K4 Quick Booking Search icon in those sections + Admin Live Activity, OCR Monitor, Audit Trail; audit filters in one row
- [x] K5 No number-input spinner arrows — unit 6: number inputs have no spinner arrows anywhere (globals.css)
- [ ] K6 Website booking summary centred
- [ ] K7 Customer export; remove Admin → Data Export (see Q9)
- [ ] K8 Visa Entry Type master (+ add button)
- [ ] K9 Pricing Dashboard: "Visa Price Table" (no Extra Charge column, visa product type, vendor cost fix); "All Services Vendor Prices" with filters + full edit; compact By-country spacing
- [ ] K10 Holidays: weekly offs per country; labels India / Destination Country; TAT excludes both countries' holidays
- [x] K11 TAT fix: Urgent = 8 working hours inside 10:00–19:00 working days (2 Nov 8 PM test gave 4 Nov for both) — unit 1: Urgent earliest date assumes a late flight + "flights after 6:00 PM" note (Mon 8 PM → Normal Wed 4 Nov, Urgent Tue 3 Nov)

## L. Chat, complaints, help desk, knowledge
- [ ] L1 WhatsApp chat: staff notifications for new messages; Bot vs Agent chats separated; chat usable while working elsewhere; auto-assign to the booking's Sales POC
- [x] L2 Complaint: WhatsApp + email on submit; notify only on Resolved (not Closed) — unit 6: enquiry / complaint acknowledged on WhatsApp too (needs the Meta template name, see M1); customer message only on Resolved, not Closed
- [ ] L3 Help desk tickets: ID `TNITXXXX`, email to creator, Admin alert, attachments, Admin ticket management (assign, status Open / In Progress / Resolved, comments, resolution note, history)
- [ ] L4 Knowledge Centre bulk upload (PDF / DOC / DOCX, progress, manage/delete)
- [x] L5 WhatsApp bot reuses known customer name/email — unit 6: a returning customer (same WhatsApp number) is not asked name / email again

## M. Notifications & emails
- [ ] M1 WhatsApp booking confirmation not sent for website bookings
- [ ] M2 Delivery emails (ticket / visa / package): distinct Important Information + Disclaimer headings, highlighted opening line
- [x] M3 Buttons open the right page (Track Booking, View Details, Pay Now — not all to the pay page) — unit 1: Track Status → /track (auto-verified by page key), Upload → #documents, Track Refund → #refund; data migration 20261116120000
- [ ] M4 Admin templates: filter by Service / Country / Status; on/off per notification and channel; editable before/after-payment content; submission messages; reminder management; Meta template editing guidance; buttons + Stop Reminder link

## N. Automation (doc "Final Automation & Notification Requirements")
- [ ] N1 Every automation: separate email + WhatsApp templates, independent on/off, dynamic variables per doc
- [ ] N2 SLA escalation per service: POC + Admin, repeat interval, further escalation, OFF = silent
- [ ] N3 Payment reminders: VC/VE every 2 h until 18:00 same day; NV/OTB/RT daily; flight quote 10/20 min then every 10 min, expire at 30 min
- [ ] N4 Document reminders 12:00 + 17:00 daily until complete; separate templates
- [ ] N5 OTB upsell UAE/Oman (day after delivery + 2 days before travel, 16:00, max 2, one per passenger)
- [ ] N6 UAE extension reminders (30-day: day 20/25/30; 60-day: 50/55/60; after extension: 25/29), 12:00
- [ ] N7 Visa Extension upsell after Visa Change approval (day 50/55/60), 12:00
- [ ] N8 Return Ticket upsell (3 days + 1 day before travel, 16:00)
- [ ] N9 Coupon automation: direct offers (NV/OTB/RT); unpaid-quotation offers (VC/Flight/VE) twice same day
- [ ] N10 New upsells: Flight → New Visa and New Visa → Special Fare (two triggers, 20:00, one 2 days before departure); lead only when an application starts
- [ ] N11 Staff alerts 11:00 / 15:00 / 18:00 per POC (own items only) + Excel attachment
- [ ] N12 Admin daily report 20:00 (email + one workbook, tab per category)
- [ ] N13 Weekly report Monday 12:00
- [ ] N14 Customer opt-out per booking (all customer reminders/upsells, both channels; staff alerts continue; audited)
- [ ] N15 No automatic booking completion; keep retention/purge settings unchanged

## S. Final status lists (doc §2–§8)
- [x] S1 Visa, Visa Change, Visa Extension, Flight, Return Ticket, OTB lists exactly per doc (CRM status, customer label, auto/manual) — unit 2a: catalog.ts + migration 20261116140000 (records on removed statuses moved, removed ones switched off)
- [x] S2 One common User Not Responding and Booking On Hold; "Quotation Sent" / customer "Quotation Ready" for all quotation services — unit 2a: one User Not Responding (common USER_NOT_RESPONDING template) + one Booking On Hold per list; Quotation Ready / Quotation Accepted
- [ ] S3 Flight: pre-issuance cancellation uses shared Cancelled / Partially Cancelled; post-issuance ends at Ticket Cancelled; Cancelled by Airline / Rescheduled by Airline — unit 2a: statuses + templates exist (Cancelled by Airline / Rescheduled by Airline new); the post-issuance cancellation / reschedule FLOWS come with the Special Fare unit (A12, A14)
- [ ] S4 Refund rules: gateway Refund ID in notification; bank transfer needs transaction no. before approval; remark required — unit 2a: Partially Cancelled / Cancelled messages now carry Refund ID + amount; bank-transfer transaction no. + remark come with unit 3 (H)
- [x] S5 "To Confirm / To Configure" rows: no automation until confirmed (Q6) — respected: no automation was added for the To Confirm / To Configure rows
