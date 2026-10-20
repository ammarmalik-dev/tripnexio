# Client doc 2026-10-20: final changes + every service's status list and templates

Source: `client-message/new-doc-from-client-20-oct/TripNexio Project.docx`. It holds live credentials in its first lines, so it is never committed (gitignored).

The client asked for every point to be done carefully so that no further correction round is needed. The status lists and templates in sections O1–O6 are the client's final versions. They are loaded as Admin data (statuses, transitions, customer labels, notification templates); the rules engine stays the same.

Legend: `[x]` = done + verified (local tests, plus a live check after deploy where marked **live✓**).

## A. Flight Special Fare
- [x] A1. Every quote option shows: — DONE: 1803042
  - airline name and flight number
  - departure / arrival city, date and time
  - baggage
  - fare type
  - quote validity
  - Booking / Reference ID
- [x] A2. The issued ticket shows the PNR, passenger details, airline, flight details and baggage, with the ticket PDF. — DONE: 1803042
- [x] A3. Passenger type (Adult / Child / Infant) is worked out from the date of birth on the website, and the fare follows the type. — DONE: 1803042
- [x] A4. Fix booking 11026FL080: it was submitted with 1 Adult + 1 Child + 1 Infant, but only 1 Adult appears and the fare is calculated wrong. — DONE: 1803042 (bot SF passengers per type)
- [x] A5. Bring back the Government ID upload after a successful payment, for all passengers. — DONE: 1803042
- [x] A6. Disclaimer: the customer name and passport number must match the government ID / passport exactly. — DONE: 1803042
- [x] A7. Ticket details: remove Vendor Reference, Ticket Number and Issue Date/Time. Keep only the PNR. — DONE: 1803042
- [x] A8. Several passengers' tickets: allow several uploads, or only the tickets issued so far. Track the ticket per passenger and show "Pending" for anyone not yet issued. — DONE: 1803042
- [x] A9. Document upload: — DONE: 1803042
  - One delivery option only (no duplicate "Issue Ticket" + "Deliver to customer").
  - A coloured "Choose File" button.
  - The file types the workflow needs, with validation.
- [x] A10. After the ticket is delivered, staff can't move the booking to Unavailable (Admin correction only). — DONE: 1803042
- [x] A11. Quotation: Vendor Cost and Selling Price for Adult / Child / Infant. The total is worked out from the passenger counts and rates (never Adult only). — DONE: 1803042
- [x] A12. The alternative option uses the same form as the quote: — DONE: 1803042
  - airport search, terminals, fare rules, date and time
  - new selling price, new cost and vendor name
- [x] A13. The ticket email body carries the "Important Information" block (domestic + international): reporting 2h / 4h, documents, terminal, web check-in, baggage, changes and refunds, travel requirements, the 12-hour verification disclaimer, closing line. — DONE: SF_15 template body
- [x] A14. A partial refund can be raised. The internal status moves when cancelled. — DONE: 1803042
- [x] A15. Refund policy lives in one place only: Service Configuration (for all services, linked to CRM). Remove it from the Pricing Dashboard. — DONE: 1803042
- [x] A16. After a refund the internal status can change, and the customer status follows automatically. — DONE: c712ee2
- [x] A17. Status changes happen automatically in all services, and every status in the client's lists is present in CRM. — DONE: c712ee2
- [x] A18. When travel is within 24 hours: create a task automatically and move the status to On Hold. — DONE: 1803042
- [x] A24. Explain "Move to…" (document status) and "Set result…" (passenger result), and make the labels self-explanatory. — DONE: labels renamed; explained in client message

## B. Return Verified Ticket
- [x] B1. Remove Vendor Reference from CRM. When a vendor rate is already set, don't ask for it again; ask for the vendor only when sending to the airline. — DONE: d95b05b + vendor reference rows removed
- [x] B2. When the vendor rate is set, don't ask for the airline fee. — DONE: airline-fee fields removed (service fee per service, F2)
- [x] B3. The Thailand + Etihad rate doesn't show on the Pricing Dashboard. Show only the airlines and destinations that are configured. — DONE: pricing dashboard vendor rates
- [x] B4. Configured required documents show for every service (Return, OTB, New Visa, Ticket), so staff can upload them, together with anything already uploaded. The status sits on one side in every service. — DONE: required-slots.ts
- [x] B5. "Deliver to customer": — DONE: 1803042
  - Ask only for the Return Verified Ticket.
  - With several passengers, list them all; staff can pick the pending ones.
  - Coloured upload button; all file types; PDF upload currently fails.
- [x] B6. The Return Ticket email body carries "Important: Please verify your details" (4 hours) plus the disclaimer and closing. — DONE: RVT_TICKET_ISSUED template body

## C. OTB
- [x] C1. Express TAT: an application at 22:30 on a Saturday (week-off) offers Monday 00:00, which is not a working hour. — DONE: null urgent TAT = 8 working hours
- [x] C2. Show only the configured countries and airlines. — DONE: website + bot list only priced country × airline
- [x] C3. Travel date and departure time on the same line (website). — DONE: one row
- [x] C4. Remove Vendor Reference for OTB. — DONE: vendor reference removed
- [x] C5. Same as B2: no airline fee when the vendor rate is set. — DONE: see B2
- [x] C6. Once a booking is paid and booked, staff must not be offered "generate booking" again (all services). — DONE: paid booking closes the lead for new bookings

## D. Visa Change / Visa Extension
- [x] D1. Unable to draft and send a quotation. — DONE: Border quote no longer blocked
- [x] D2. The visa expiry date/time is wrong at customer review and payment: verified 17 Oct, but urgency showed 19 Oct. — DONE: urgency from verified expiry day
- [x] D3. Website: ask for the passport and visa copy on the same line.
- [x] D4. Form text alignment after submission (success panel).
- [x] D5. WhatsApp bot passenger details:
  - Ask the number of adults and children, plus "Add another passenger".
  - Ask passport and visa expiry for everyone.
  - Label "Visa Expiry Date*".
- [x] D6. Can't save and share the itinerary for Border and A2A. Per-passenger cost / sale / fine is missing (tested with 2 people, but the price was set for one). — DONE: per-passenger costing + border/A2A blocks save
- [x] D7. Wording: "Our team will confirm the exact document checklist as per nationality once we review your request."
- [x] D8. By bus (Border): — DONE: border on the quote, trip details on the booking
  - Remove "Border Exit Operational Details".
  - The quotation asks only the non-UAE border, rate, inclusions and exclusions.
  - After payment, ask the vendor-specific details (like A2A).
  - Remove Customer Contact Number, Drop / Border Location, Bus / Operator and Vendor / Sponsor.
- [x] D9. Visa Change submission: don't mention the destination country in the WhatsApp or email notification.
- [x] D10. Visa Change document management: Admin-configured documents per nationality, uploadable after payment. — DONE: VC types per nationality + booking slots after payment
- [x] D11. The Visa Change ticket / package email carries "Important Travel Instructions" (3 hours) plus the disclaimer. — DONE: VC_PACKAGE_GENERATED template body

## E. New Visa
- [x] E1. Expected approval date and TAT follow the Admin working days, holidays, non-working days, country / service rules and blocked dates. It updates at once when Normal / Express changes. No hard-coded dates. (Screenshot: UAE / India / 5 Nov shows "Not offered" and "travel date too close".) — DONE: prices/availability judged only after the option + nationality are chosen; approval date on the destination calendar
- [x] E2. The configured Adult / Child prices for Normal and Express show at once on the first form and update on switch. — DONE: Adult/Child per Normal/Express on the first form
- [x] E3. Remove "Choose your option and see the price instantly" for all countries. — DONE: selector section removed from country pages
- [x] E4. Vendor rates for Visa / OTB / Return Ticket show correctly (Visa is missing). New Visa vendor rates take Adult / Child × Normal / Express without forcing a visa type. — DONE: pricing dashboard vendor rates
- [x] E5. Only Admin-enabled destination countries on the website and the bot. No duplicates, disabled ones hidden. The UAE visa page shows destination countries only. — DONE: one destination list (published page or active product) for form, server and bot
- [x] E6. Visa types per country, set up in Admin from the Master List: — DONE: product = stay · entry · category; no separate Visa Type
  - Validity, Stay Duration, Entry Type (Single / Multiple) in the master.
  - Category (Tourist, Transit, Business, Arrival Card).
  - Only enabled countries.
- [x] E7. Website + bot show the options in one line: Stay Duration → Entry Type → Visa Category. Only configured options. — DONE: one-line option label, website + bot
- [x] E8. The bot's Oman New Visa option is missing. The bot shows every enabled country and its visa types, as the website does. — DONE: bot uses the same destination list (Oman)
- [x] E9. New Visa: application details + payment first; the document upload opens only after payment (website + bot). — DONE: documents only after payment (website + bot)
- [x] E10. The timeline / TAT configuration is respected on the website and in the bot. — DONE: bot counts on the destination calendar

## F. Invoice & profit
- [x] F1. An invoice cancelled or refunded after verification shows Cancelled / Refunded on the QR verify page, not Paid. — DONE: d95b05b
- [x] F2. Admin sets the service fee and GST % separately per service. — DONE: d95b05b
- [x] F3. The invoice shows only the configured service fee, with GST on that fee only (e.g. cost 1,000 / sell 1,200 / fee 20 → the invoice shows fee 20 + GST on 20). — DONE: d95b05b
- [x] F4. MIS / P&L show the actual profit (selling − cost = 200), never the service fee. — DONE: reports use the quotation margin, never the invoice fee

## G. WhatsApp chat & FAQ
- [x] G1. FAQ option in the WhatsApp menu, working. — DONE: FAQs row + numbered list, number or own question
- [x] G2. All menu options are clear, with no blank gaps. — DONE: no blank gap lines; 9 clear rows
- [x] G3. When a customer connects to an agent, show an alert in the assigned POC's chat section, plus a chat window in CRM. — DONE: POC alert on handover and on each chat message; CRM → WhatsApp Chats
- [x] G4. Keep the booking open while the agent chats (no need to search again). — DONE: alert + chat window open the customer's booking on its chat tab
- [x] G5. The "Our team has this — they'll reach out shortly…" reply goes out only once at handover, not after every message. — DONE: no bot reply after handover

## H. Emails
- [x] H1. "Best regards, Team TripNexio" appears twice. Keep it once, in the mail body before "Need assistance?". — DONE: d95b05b
- [x] H2. Header as in the client image: navy, "TripNexio" with the tagline line. — DONE: d95b05b

## I. Enquiries
- [x] I1. Contact form serial ENQ-TNA0001 … ENQ-TNZ9999. — DONE: d95b05b
- [x] I2. When an enquiry is closed or resolved, email the customer with the remark. — DONE: d95b05b

## J. Invoice number
- [x] J1. Invoice serial TNS/A2601 … TNS/A2699, then TNS/B2601 … TNS/Z2699 (letter changes after 99, then AA/AB…). The year part changes every financial year. — DONE: d95b05b (TNS/A2601)

## K. Manual lead / flows / documents
- [ ] K1. Manual lead pricing + payment:
  - The configured amount is fetched from Admin.
  - The base / service amount is shown.
  - A per-service form (e.g. visa expiry for Visa Change / Extension).
  - Coupon, and a clear final payable.
  - Extra charges allowed (the configured amount is not a cap).
- [ ] K2. New Visa: Lead → direct payment link → payment success → Booking → Documents → processing.
- [ ] K3. All documents in one Booking Documents section (from Lead and Booking), per traveller.
- [ ] K4. Document statuses: Pending, Uploaded / Received, Validated, Rejected, Additional Documents Required.
- [ ] K5. One consolidated notification once all documents are validated, or one on reject / additional request listing pax + docs. Never per document.
- [ ] K6. Booking 360 shows only the current booking's travellers' documents; history stays in Customer 360.

## L. CRM workflow
- [x] L1. Coloured "Choose File" button; PDF / PNG / JPG only. — DONE: coloured Choose File on every CRM upload, PDF/PNG/JPG
- [x] L2. CRM and Admin: remove the per-group collapse/expand buttons; keep only the sidebar toggle. — DONE: only the sidebar toggle
- [x] L3. Leads: Refresh and Export buttons in the second row. — DONE: second row, right side
- [x] L4. Customers: — DONE: Search instead of Refresh; Edit details + Delete account in Customer 360
  - Remove Refresh; add Search.
  - CRM can delete a customer account and edit the name, email and mobile.
- [x] L5. Restore email OTP verification at account creation. — DONE: every new signup confirms the email with a 6-digit code
- [x] L6. Bookings table: — DONE: Created From/To, two filter rows, sub-service under Service Details, no repeated travel date, one-line headers, 2-line cells, auto widths + scroll
  - Creation-date From / To calendar instead of 7/30/90.
  - Filters within 2 rows.
  - No Sub-service column (details under Service Details), and no repeated travel date.
  - Internal Status, Service Details and Applied to Embassy on one line.
  - Cells max 2 lines, auto column widths, horizontal scroll.
- [x] L7. Booking status: internal status buttons on the left. The internal status updates the customer status automatically. No reverting of critical statuses. — DONE: c712ee2
- [x] L8. Payments: buttons and headings on one line; Service and Service Details in separate columns. — DONE: one-line filters/buttons; Service and Service Details columns
- [x] L9. Invoices: filters on one line. — DONE: all invoice filters on one line
- [x] L10. Refunds: — DONE: one-line filters; Amount / Reason / Refund ID columns
  - Filters on one line.
  - Amount, Reason and Refund ID on one line, with reason and ID in separate columns.
- [x] L11. Documents & Tasks: filters on one line. — DONE: documents + tasks filters on one line
- [x] L12. Follow-ups: filters within 2 rows. — DONE: follow-ups filters in two rows
- [x] L13. Global: compact, no duplicate fields / headings / buttons. — DONE: compact shared date filter (no 7/30/90 buttons) across lists
- [x] L14. (Screenshot) The Notifications panel is hidden behind the record tabs (z-index). — DONE: topbar above the record tabs

## M. Site / Admin
- [x] M1. Admin Live Activity: every bottom line on a single line. — DONE: compact one-line pagination + single-line rows
- [x] M2. Footer bottom: only "© 2026 TripNexio. All rights reserved." — DONE: only the copyright line; Cookie settings moved to the Cookie Policy page
- [x] M3. The cookie banner shows once; it doesn't come back after a choice. — DONE: choice kept on the whole domain + localStorage copy
- [x] M4. WhatsApp Support number correct, on one line on mobile, working link. — DONE: live WhatsApp Business number +91 81161 22850 fallback, no wrap
- [x] M5. Company / Support / Legal pages: justified text, consistent spacing, responsive. — DONE: justified text on Company / Support / Legal pages

## N. Booking status filter
- [ ] N1. Booking-level statuses: Confirmed, Processing, Partial Approved, Completed, Cancelled, Partial Refund, Cancelled (Refunded).
- [ ] N2. Rules:
  - A partial refund shows that the passenger was cancelled.
  - Some passengers approved and some rejected → Completed.
  - Partly processed + partly refunded → the refund completes first, then the booking shows its fresh status.

## O. Status lists + Email / WhatsApp templates (client's final, per service)
- [x] O1. **New Visa**: — DONE: c712ee2
  - 22 statuses with customer labels and notify flags, per the matrix.
  - Separate email + WhatsApp template per notifying status (NV_*).
  - Pre-payment: Application ID only, Complete Payment CTA, no Booking ID or invoice.
  - The invoice is attached to the Payment Received email.
  - Visa Approved: PDF attached + secure link + travel instructions / disclaimer.
  - Internal-only statuses send nothing.
- [x] O2. **Visa Change**: — DONE: c712ee2
  - 27 statuses (VC_*).
  - Package Generated → Exit Completed → Ready for Submission.
  - Package PDF attached.
  - No duplicate at Cancelled and Refunded.
- [x] O3. **Visa Extension**: 23 statuses (EXT_01–EXT_23) with their templates. — DONE: c712ee2
- [x] O4. **OTB**: — DONE: c712ee2
  - 19 statuses (OTB_01–OTB_19).
  - Track Status CTA.
  - No OTB approval PDF.
- [x] O5. **Return Verified Ticket**: — DONE: c712ee2
  - 15 statuses (rvt_*).
  - Ticket PDF attached / linked at Ticket Issued.
  - Partial cancellation scope per passenger.
- [x] O6. **Flight Special Fare**: — DONE: c712ee2
  - Lead, quotation, booking and cancellation statuses (SF-EM / SF-WA 01–29).
  - Expiring reminders every 10 minutes while the quote is valid.
  - Seat-unavailable and cancellation-quotation flows.
  - Follow-up Due removed.
- [ ] O7. Notifications fire once per real transition (deduplicated) and are logged with the template, recipient and outcome.
