# Client doc 2026-10-15: all services, bot, CRM, Admin, invoices, emails

Source: `client-message/new-doc-from-client-15-oct/TripNexio Project.docx`. It holds live credentials, so it is never committed. The same folder also holds the GST certificate and the Udyam certificate.

Client message: "implement all corrections… consistently to avoid repeated corrections". Email and Meta templates and any missing service statuses come tomorrow. The display name was rejected twice.

## A. Business / Meta
- [ ] A1. WhatsApp display name "TripNexio" rejected twice. Guide the client:
  - Meta Business Verification with the GST certificate (trade name TRIPNEXIO, GSTIN 09ALTPR2177H1ZE).
  - The name must match the website, which needs the legal details visible.
  - Then re-submit.
- [ ] A2. GST is registered. Enable 18% on the service charge only. GSTIN and legal entity go on the invoice and the website (SystemConfig).
- [ ] A3. Share the Meta template format again.

## B. WhatsApp bot
- [ ] B1. New greeting:
  - Short text with a "See Options" button.
  - Product names only, and only Admin-enabled services.
  - English and Hinglish; "Agent" reaches staff.
- [ ] B2. Customer outside the UAE: offer only New Visa. Inside the UAE: offer Visa Change when the current visa is not from TripNexio. When no TripNexio visa is found, show "TripNexio Visa Not Found" and offer New Visa or Visa Change.
- [ ] B3. After lead creation: a thank-you message with a link to upload the passport and visa copies; the team validates and shares the quotation.
- [ ] B4. Multiple passengers: name, passport number and expiry. No DOB on WhatsApp.
- [ ] B5. Visa Change: ask the number of adults and children, plus "Add another passenger".
- [ ] B6. New Visa:
  - Only Admin-enabled countries (website as well).
  - Ask stay duration / category and passenger count, with Adult (18+) and Child only (no infant).
  - Payment first, then documents.
- [ ] B7. Duplicate confirmations for Visa Change, New Visa and Extension: send one message. The Visa Change text is: "Your Visa Change request has been received. Our team will check availability and share an update with you."

## C. Leads / CRM general
- [ ] C1. Website leads appear in CRM search immediately (all services).
- [ ] C2. Lead serial numbers: no duplicates or gaps between website and WhatsApp.
- [ ] C3. Country flag + short code for Extension, Return Ticket, OTB and Flights. The Indian flag for domestic flights within India.
- [ ] C4. List layout for Leads, Bookings, Quotations, Payments, Invoices, Tasks and Follow-ups:
  - Normal/Urgent under the booking ID.
  - Sub-service column: visa type for visas, airline for flights.
  - 10 rows per page; darker header line.
  - Less top space.
  - One centred search bar; filters within two lines.
- [ ] C5. Sidebar expand/collapse controls in CRM and Admin.
- [ ] C6. Staff cannot assign each other's leads or bookings.
- [ ] C7. No previous booking / lead / quotation communication or timeline inside a new one; history stays in Customer 360.
- [ ] C8. Website form text alignment after submission.

## D. Visa Extension
- [x] D1. Costing:
  - Fields: Vendor, Extension cost, Fine, Selling amount.
  - Profit = Selling − Cost − Fine; GST on profit; gateway charge on the full amount.
  - Coupon: client reply 2026-10-15 "keep one only". The Visa Extension quote already has a single Coupon Code field, so nothing changes.
- [x] D2. Wrong visa expiry date/time on the review and payment screens.
- [x] D3. Multiple passengers: cost, fine and selling per passenger; partial approval and payment.
- [x] D4. New T&C text and checkbox.

## E. Visa Change
- [x] E1. Website: the "after availability is confirmed you will see…" lists for A2A and Border.
- [x] E2. Document checklist per passenger by that passenger's own nationality.
- [x] E3. A2A CRM:
  - Airport search inside the field.
  - Departure terminal.
  - Remove the reporting time.
  - T&C attached automatically to the quote / package.
- [x] E4. Profit = Selling − Vendor cost − Fine; GST on profit (A2A and Border).
- [x] E5. New T&C text and checkbox; "Important Travel Instructions" in the ticket / package email.

## F. New Visa
- [x] F1. First form:
  - Expected approval date (working calendar).
  - Adult and Child prices for Normal and Express.
  - Values chosen on the country card carried forward; no repeated questions; Basic Details then Applicant Details.
- [x] F2. One timeline per country (remove the duplicate New Visa timeline settings).
- [x] F3. Admin pricing and vendor cost:
  - Remove Sub-Service and the documents section; documents live on the country page.
  - Selling price by country × nationality × Adult/Child × Normal/Urgent, with no government or vendor fee fields.
  - Vendor cost comes from the vendor selected during processing (same keys) and drives profit and the invoice.
- [x] F4. Configuration fields:
  - Visa validity, stay duration, entry type, visa category (Tourist / Transit / Business / Arrival Card).
  - Remove the description.
- [x] F5. Editable T&C per country (with a default draft), with checkbox and "Accept & Proceed to Payment".
- [x] F6. Fully editable country pages (headings, service names, banners, How It Works; ETA / arrival card wording).
- [x] F7. Profit = Selling − Vendor cost; GST on that.

## G. Invoice & profit
- [x] G1. Remove "Amount Paid" and "Balance Due".
- [x] G2. Invoice status Cancelled, then Refunded when the refund completes (not "Paid").
- [x] G3. Govt / Airline / Vendor fee rows aligned full width.
- [x] G4. Profit = Selling − applicable vendor / govt / airline fee − fines.
  - New Visa, Visa Change, Extension: the vendor / govt fee.
  - Return Ticket, Special Fare, OTB: the airline fee.
  - GST on the service charge.
- [x] G5. Gateway charge:
  - Charged to the customer: shown separately on the invoice and included in the payable amount.
  - Not charged: our expense.
- [x] G6. Admin can edit an invoice later (cost, service fee, GST).

## H. Email template
- [ ] H1. Light-blue body; dark header with logo, name and tagline.
- [ ] H2. Aligned contacts; single-line "automated email" note.
- [ ] H3. "Follow Us On" icons (Instagram, Facebook, LinkedIn, X, Threads); responsive.

## I. Status, documents, refunds
- [ ] I1. Per-service status flows enforced server-side (no backward moves; e.g. an approved OTB can't be rejected).
- [ ] I2. Automatic statuses:
  - "Documents Validated" when every document is validated, with a notification.
  - "PDF Delivered" when the visa PDF is uploaded.
- [ ] I3. OTB:
  - No OTB document upload.
  - OTB statuses; a rejection shows "Rejected", not "Cancelled", everywhere.
- [ ] I4. Passenger-level partial approval, rejection and cancellation ("Partially Approved" / "Partially Cancelled"), with the selling, cancellation and refund amounts.
- [x] I5. Refunds:
  - Admin approval, then automatic gateway refund; the refund id is fetched.
  - Status follows the real refund result (Cancelled / Partially Cancelled).
  - The admin can approve a refund they raised.
  - The customer is notified on lead creation, extra payment link and refund.
- [x] I6. Documents:
  - One Booking Documents area (from both lead and booking) with PAX sections.
  - Statuses: Pending, Received, Validated, Rejected, Additional Required.
  - One consolidated customer notification listing which passenger needs which document.
- [x] I7. Vendor choice:
  - OTB / New Visa / Return Ticket: the vendor is picked from the enabled vendors after all documents are validated; P&L from the buying rate.
  - Visa Change / Visa Extension / Special Fare: the vendor comes from the selected quotation.
- [x] I8. Upload button in colour; PDF / PNG / JPG under 3 MB.
- [ ] I9. Admin can refund at any status, and move a status or document back, with audit.

## J. Admin / site misc
- [ ] J1. Coupons: no lead code / booking id required to create one.
- [ ] J2. Blog: new photo and category options; search above the articles.
- [ ] J3. Editable photos and content for the Home, Visa Change, Visa Extension, OTB, Flight and Return Ticket pages.
- [ ] J4. OCR cross-checks:
  - The uploaded passport, visa and ticket against the entered data (passport number, name, DOB, visa expiry); flag "manual validation required" on a mismatch.
  - Capture the ticket PNR and flight details.
- [ ] J5. AI Command Center: booking logs, passport details, staff logs, active airports, reports with visuals and Excel.
- [ ] J6. Holidays: edit and delete.
- [ ] J7. Customer account: deletion, and changing mobile / email after signup.
- [ ] J8. Less top space on every website / service page.
- [ ] J9. Admin can add or remove required documents and edit T&C for every service (New Visa via its country page).
- [ ] J10. Remove OTB, Return Ticket, Special Fare, Visa Change and Extension from the Service Configuration page (managed in the Pricing Dashboard / Airlines).
- [ ] J11. All new countries: payment first, then documents.
