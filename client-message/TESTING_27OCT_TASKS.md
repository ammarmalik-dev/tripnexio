# Client doc 27 Oct 2026 — task checklist

Source: `client-message/new-doc-from-client-27-oct/TripNexio Project.docx` (holds live credentials — never commit it).
The status/notification template appendix (New Visa / Visa Change / OTB / Special Fare) is the same as the 20 Oct doc, already in `template-catalog.json`.

## A. Special Fare
- [ ] A1 Requests 11026FL097 (web) / 11026FL098 (WhatsApp) not visible in CRM/Admin (they wait in Quotations → Awaiting quotation, not Leads)
- [ ] A2 Passenger form: Full Name* / Date of Birth* placeholders; type from DOB; summary fix
- [ ] A3 Ticket details: keep only PNR (remove vendor ref, ticket number, issue date/time)
- [ ] A4 Ticket per passenger: upload issued tickets only; others show Pending
- [ ] A5 After a ticket is delivered, staff can't mark Unavailable (Admin override only)
- [ ] A6 Quote: vendor cost + selling price for Adult / Child / Infant, totals by counts
- [ ] A7 Alternative option uses the same flight form (airports, sectors, fare rules, date/time) + new selling price, new cost, vendor
- [ ] A8 Ticket email: Important Information block (domestic + international)

## B. Return Ticket
- [ ] B1 Travel more than 24h away → task + On Hold (only Return Ticket)
- [ ] B2 Remove vendor reference number when Sent to Airlines

## C. OTB
- [ ] C1 Sent to Airlines blocked until every document is validated
- [ ] C2 Refund Completed only through a raised + approved refund
- [ ] C3 Partially Cancelled only through an approved refund
- [ ] C4 After partial refund, no further status options
- [ ] C5 Service fee / GST only on the configured service fee (not the whole amount)
- [ ] C6 OTB TAT is per airline — remove it from the Pricing Dashboard
- [ ] C7 Track Status: "Partially approved" step only when it happened
- [ ] C8 Pay page shows "Uploaded" for documents not uploaded
- [ ] C9 One upload button per document (OCR runs on it); visa OCR not filling details
- [ ] C10 Remove OTB PNR / reference (required to approve)
- [ ] C11 One document notification after all are validated (which passenger, which document)
- [ ] C12 No "Add passenger" on a paid booking
- [ ] C13 Vendor not auto-picked: ask vendor at Sent to Airlines, P&L from its rate

## D. Visa Extension / Visa Change
- [ ] D1 Unable to submit website form
- [ ] D2 Unable to draft / share / send quotation
- [ ] D3 Visa expiry: verified 17 Oct but urgency payment showed 19 Oct
- [ ] D4 Passport and visa copy upload on one line
- [ ] D5 Text alignment on the after-submission panel
- [ ] D6 WhatsApp bot submission not seen in CRM (same as A1)
- [ ] D7 Visa Change: save + share itinerary (Border / A2A); per-passenger cost, selling, fine
- [ ] D8 Text: "Our team will confirm the exact document checklist as per nationality…"
- [ ] D9 Border details: remove Customer Contact Number, Drop / Border Location, Bus / Operator, Vendor / Sponsor
- [ ] D10 Visa Change request received: no destination country in WhatsApp / email
- [ ] D11 Visa Change documents per nationality in Admin, asked after payment
- [ ] D12 Visa Change package email: Important Travel Instructions block

## E. New Visa
- [ ] E1 Expected approval date skips holidays / non-working days
- [ ] E2 Vendor rates: visa type selection
- [ ] E3 Pay page shows "Uploaded" for documents not uploaded (same as C8)
- [ ] E4 GST off still adds GST

## F. Invoice & profit
- [ ] F1 Verify page (QR) shows Cancelled / Refunded, not Paid
- [ ] F2 Invoice service fee = configured fee, GST on it only; MIS / P&L profit = selling − cost

## G–N. Other
- [ ] G1 WhatsApp chat: CRM alert + customer messages visible after agent handover
- [ ] H1 Email: one "Best regards, Team TripNexio" before Need assistance; header "TripNexio / Travel Made Easy with TripNexio."
- [ ] I1 Enquiry ENQ-TNA0001 → ENQ-TNZ9999; customer email with remark when Resolved / Closed
- [ ] J1 Invoice serial TNS/A02601 → after 99 next letter; new year every financial year
- [ ] K1 Manual lead: payment link / manual payment option
- [ ] M1 Email OTP at account creation
- [ ] N1 Booking status: internal status buttons on the left, customer status follows, no reverting
