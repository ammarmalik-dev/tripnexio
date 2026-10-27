# Client doc 27 Oct 2026 — task checklist

Source: `client-message/new-doc-from-client-27-oct/TripNexio Project.docx` (holds live credentials — never commit it).
The status/notification template appendix (New Visa / Visa Change / OTB / Special Fare) is the same as the 20 Oct doc, already in `template-catalog.json`.

Status 27 Oct: every item done and deployed (commits 04bb511, ed1c1fc, 377cff8; backups pre-deploy-20261027T154422 / T160145).
Live-tested on tripnexio.com: Leads list shows FL097/FL098/VC105 "Awaiting quotation"; SF form passenger step + summary; SF quote draft -> send (11026FL107); VE form with PDF passport + visa copy submits (11026VE108); success panel centred; OTB Sent to Airlines blocked until documents validated (OT099); Track Status shows only real steps in order; Pricing Dashboard OTB view has no TAT; VC_NEW templates carry no country. Test leads FL107 / VE108 cancelled.
Open for the client: one service has GST % 17.83 in Admin → Services (others 18); default OTB TAT (airline without its own TAT) has no edit screen now; payments made before 27 Oct keep their old fee/GST split; M1 email OTP was already live — need the exact screen where it failed.

## A. Special Fare
- [x] A1 Requests 11026FL097 (web) / 11026FL098 (WhatsApp) not visible in CRM/Admin (they wait in Quotations → Awaiting quotation, not Leads)
- [x] A2 Passenger form: Full Name* / Date of Birth* placeholders; type from DOB; summary fix
- [x] A3 Ticket details: keep only PNR (remove vendor ref, ticket number, issue date/time)
- [x] A4 Ticket per passenger: upload issued tickets only; others show Pending
- [x] A5 After a ticket is delivered, staff can't mark Unavailable (Admin override only)
- [x] A6 Quote: vendor cost + selling price for Adult / Child / Infant, totals by counts
- [x] A7 Alternative option uses the same flight form (airports, sectors, fare rules, date/time) + new selling price, new cost, vendor
- [x] A8 Ticket email: Important Information block (domestic + international)

## B. Return Ticket
- [x] B1 Travel more than 24h away → task + On Hold (only Return Ticket)
- [x] B2 Remove vendor reference number when Sent to Airlines

## C. OTB
- [x] C1 Sent to Airlines blocked until every document is validated
- [x] C2 Refund Completed only through a raised + approved refund
- [x] C3 Partially Cancelled only through an approved refund
- [x] C4 After partial refund, no further status options
- [x] C5 Service fee / GST only on the configured service fee (not the whole amount)
- [x] C6 OTB TAT is per airline — remove it from the Pricing Dashboard
- [x] C7 Track Status: "Partially approved" step only when it happened
- [x] C8 Pay page shows "Uploaded" for documents not uploaded
- [x] C9 One upload button per document (OCR runs on it); visa OCR not filling details
- [x] C10 Remove OTB PNR / reference (required to approve)
- [x] C11 One document notification after all are validated (which passenger, which document)
- [x] C12 No "Add passenger" on a paid booking
- [x] C13 Vendor not auto-picked: ask vendor at Sent to Airlines, P&L from its rate

## D. Visa Extension / Visa Change
- [x] D1 Unable to submit website form
- [x] D2 Unable to draft / share / send quotation
- [x] D3 Visa expiry: verified 17 Oct but urgency payment showed 19 Oct
- [x] D4 Passport and visa copy upload on one line
- [x] D5 Text alignment on the after-submission panel
- [x] D6 WhatsApp bot submission not seen in CRM (same as A1)
- [x] D7 Visa Change: save + share itinerary (Border / A2A); per-passenger cost, selling, fine
- [x] D8 Text: "Our team will confirm the exact document checklist as per nationality…"
- [x] D9 Border details: remove Customer Contact Number, Drop / Border Location, Bus / Operator, Vendor / Sponsor
- [x] D10 Visa Change request received: no destination country in WhatsApp / email
- [x] D11 Visa Change documents per nationality in Admin, asked after payment
- [x] D12 Visa Change package email: Important Travel Instructions block

## E. New Visa
- [x] E1 Expected approval date skips holidays / non-working days
- [x] E2 Vendor rates: visa type selection
- [x] E3 Pay page shows "Uploaded" for documents not uploaded (same as C8)
- [x] E4 GST off still adds GST

## F. Invoice & profit
- [x] F1 Verify page (QR) shows Cancelled / Refunded, not Paid
- [x] F2 Invoice service fee = configured fee, GST on it only; MIS / P&L profit = selling − cost

## G–N. Other
- [x] G1 WhatsApp chat: CRM alert + customer messages visible after agent handover
- [x] H1 Email: one "Best regards, Team TripNexio" before Need assistance; header "TripNexio / Travel Made Easy with TripNexio."
- [x] I1 Enquiry ENQ-TNA0001 → ENQ-TNZ9999; customer email with remark when Resolved / Closed
- [x] J1 Invoice serial TNS/A02601 → after 99 next letter; new year every financial year
- [x] K1 Manual lead: payment link / manual payment option
- [x] M1 Email OTP at account creation
- [x] N1 Booking status: internal status buttons on the left, customer status follows, no reverting

## Follow-up 27 Oct (commit 0d58574, backup pre-deploy-20261027T175953)
- Code review + local end-to-end run (mock gateway) of OTB / Return Ticket / New Visa: documents, consolidated notifications, Sent to Airlines / Applied blocks, vendor rate → cost, OTB approve without PNR, paid lead add-passenger 409, refund maker-checker + partial refund, Track Status, RT early hold + task, New Visa holiday — all PASS after fixes.
- Fixed from that run: Track Status order, cancelled passenger blocking vendor choice, staff "Documents Validated" without validated documents, SF cheaper-alternative GST over-refund, RT hold on refund statuses, New Visa rules for long country codes, per-passenger delivery messages deduped, override audit only on success.
- Partial refund: remaining passengers carry on (client status matrix "remaining passengers may stay active"); refund statuses only from the refund engine.
- Client reply: invoice serial AA02699 → AB02601 (already so); Special Fare summary = Trip Details / Flight Details / Pax Info / Fare Info (done).
- Not run end to end (agent stopped): SF payment → per-passenger tickets, VE/VC quote send after payment, GST-on invoice, email render, WhatsApp handover, manual lead, enquiry email, signup OTP — covered by unit tests and code review only.
