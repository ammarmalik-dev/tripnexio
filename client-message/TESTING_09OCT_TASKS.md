# Client testing feedback — 2026-10-09 (task list)

Source: `client-message/new-doc-from-client-09-oct/TripNexio Project.docx` (contains live credentials — never commit that folder).
`[ ]` = to do, `[x]` = done, `(confirm)` = wording unclear, ask the client.

## A. Service flow (highest priority)
- [x] A1. New Visa / OTB / Return Ticket on the website: payment first → booking (same reference) → documents; no "team will reach out" lead, no quotation.
- [x] A2. Same three services in CRM: no quotation option — only "Create Payment Link" from the lead.
- [x] A3. Return Ticket / OTB confirmation message replaced by the payment link (not "Our team will reach out shortly").
- [x] A4. All documents asked only after payment (remove passport upload from the forms: New Visa basic step, OTB, Visa Change).
- [x] A5. Failed payment never moves the record into active Bookings (verify).

## B. Website
- [ ] B1. Home hero: "Tell us what you need…" text not readable on the hero image.
- [ ] B2. Track Status button not mobile-friendly (home + "Ready to simplify your journey?" CTA).
- [ ] B3. Images: Visa Change gets the current Special Fare image; Special Fare gets a new good image.
- [ ] B4. Link preview on WhatsApp/SMS shows the old "India to the UAE and GCC" image — new OG image with the tagline.
- [ ] B5. Track Status timeline overflows its card (steps go outside the box).
- [ ] B6. Special Fare: "What You'll Need" = client's list (Full name, Mobile, Email, Departure city/airport, Destination city/airport, Travel date, Passenger details, Passport/Govt ID, Visa copy) each with a description.
- [ ] B7. Special Fare: departure/arrival city fields wrong on desktop (mobile OK).
- [ ] B8. Special Fare: country select shows flags and only enabled countries.
- [ ] B9. Special Fare success text: "Your Special Fare request has been received successfully. Our team will check the available fares and share your quotation with you shortly on WhatsApp and email." — same text in the WhatsApp + email template.
- [ ] B10. Special Fare T&C: auto-fit standard points (e.g. carry/re-post govt ID) for every service.
- [ ] B11. Return Ticket: "What You'll Need" (Full name, Mobile, Email, Passport number, Destination country, Number of passengers, Travel date, Expected return date) with descriptions.
- [ ] B12. Return Ticket: remove "Return ticket" from Documents Required (keep Passport copy required, Visa copy optional).
- [ ] B13. Return Ticket: price shown on the same line as Expected Return Date.
- [ ] B14. OTB: "Apply for OTB" button at the top and bottom of the page.
- [ ] B15. OTB: "What You'll Need" (Full name, Passport number, Mobile, Email, Destination country, Airline name, Travel date) with descriptions; fix the airline-name wording.
- [ ] B16. OTB: remove "Applicants: 1. Final pricing is confirmed by our team." on date select.
- [x] B17. OTB: destination list shows only countries enabled for OTB in Admin.
- [ ] B18. Visa Extension: "What You'll Need" (Name, Mobile, Email, Passport number, Visa expiry date) with descriptions.
- [ ] B19. Visa Extension success text = WhatsApp + email template ("Your Visa Extension request has been received. Our team will validate each applicant's details and documents and get in touch shortly.").
- [ ] B20. Visa Extension: prior TripNexio visa check matched the wrong record — fix matching.
- [ ] B21. Visa Extension: if no TripNexio visa (or wrong passport/DOB), after the lead ask the customer to upload the visa copy (website + WhatsApp).
- [ ] B22. Visa Change: correct copy — "Currently in the UAE?" block, method descriptions (Border Exit & Re-entry / Airport-to-Airport) as given.
- [ ] B23. Visa Change: documents (passport front/last, photo) after payment; visa copy line (confirm).
- [ ] B24. Visa Change success text = WhatsApp + email template.
- [ ] B25. New Visa: Expected Approval Date shown immediately from Admin working days/holidays, with blocked calendar dates.
- [ ] B26. New Visa first page: Adult & Child price for each of Normal / Express.
- [ ] B27. New Visa country cards: "Price on Request" → only Apply Now; show Normal/Express availability; cards auto-centre (1 card centred, rows even).
- [ ] B28. New Visa: Search Destination box above the country cards.
- [ ] B29. New Visa: visa type/option chosen on the card carried forward (not asked again); Basic Details → straight to Applicant Details.
- [ ] B30. New Visa: Processing Time | Visa Stay | Visa Validity in one row on the page.
- [ ] B31. New Visa: country-wise Normal/Express timeline config in Admin works.

## C. WhatsApp bot
- [x] C1. Ask number of passengers (Adult / Child / Infant) and collect each passenger.
- [x] C2. Ask passport number.
- [x] C3. OTB: ask destination country (needed for price → payment link → documents).
- [x] C4. New Visa in chat: no adult/child/travel-date re-asking beyond what's needed; TAT-blocked date → suggest Express or another date; send payment link with Booking ID, then documents.
- [x] C5. Status check inside WhatsApp (reference + last 4 digits) — no redirect to the website.
- [x] C6. "Talk to expert": staff can chat with the customer from the CRM (live WhatsApp inbox / reply).
- [x] C7. Don't send a wa.me link inside WhatsApp.
- [ ] C8. Request-received templates per service shared by WhatsApp and email (B9/B19/B24).

## D. Contact settings
- [x] D1. Admin: Phone, WhatsApp and Email configured separately (changing phone must not change WhatsApp); same on invoices.
- [ ] D2. All WhatsApp / email templates managed from Admin.

## E. CRM
- [x] E1. Manual lead: amount fetched from Admin, base amount shown, coupon applied, final payable shown, extra charges allowed above configured amount.
- [ ] E2. Home: "Need Attention" and "Expiring Soon" as buttons in Operations Overview (not long lists).
- [ ] E3. Staff can create coupons without Admin approval up to a limit — "500" (confirm: ₹500 max discount or 500 coupons).
- [x] E4. Customer notified (with link) when: lead created, extra payment link raised, refund raised.
- [x] E5. Refunds: Admin who raised can also approve; approval triggers the gateway refund automatically; booking → Cancelled after refund; invoice auto-cancelled.
- [ ] E6. Current record shows only its own communication/timeline; previous bookings/leads/quotations in a separate History.
- [ ] E7. Staff see only their own leads / bookings / quotations and act on them.
- [ ] E8. Auto-assign not working — assign by staff scope, never to Super Admin.
- [ ] E9. Full internal + customer status lists per service so staff can move statuses correctly.
- [ ] E10. Documents: PAX-level view / validate / reject (reason) / download / staff upload in lead + booking; one customer notification when all validated or something is required; documents only from the master list.
- [ ] E11. Deliver output: document type auto-selected (ticket for ticket bookings, visa for visa).
- [ ] E12. Vendor name captured before "Applied" (confirm wording "do not show vendor name on booking section").
- [ ] E13. Lead / Quotation / Booking / Payment lists like the client's table screenshot: proper capitalisation, Applied to Embassy + Vendor columns, PAX under Booking ID, every status in the filters, country flags, service details column.

## F. Admin
- [ ] F1. AI Command Centre — not go-live ready, fix.
- [ ] F2. Airports: country flag auto-fetched from the country when creating; searchable airport picker in CRM quotation/lead forms.
- [ ] F3. Airlines: logo not working — fix.
- [ ] F4. OTB timeline calculated in working hours (verify).
- [ ] F5. Coupons: Create → table → open/edit → save (check).
- [ ] F6. Pricing Dashboard reported "not working" — verify on production and fix.
- [ ] F7. Service Configuration: one short view; TAT for all countries; documents from Document Master; summary cards on top.
- [ ] F8. Admin sidebar: pure-white look; only one accordion open; Overview button fixed.
- [ ] F9. Blog: new photos, categories, search above articles, 4 cards per row centred.
- [ ] F10. Document Master: search bar.
- [ ] F11. Login: bigger logo; "Administrative Login" on one line; non-admin choosing Administrative Login gets "not authorised" (stays CRM-only).

## G. Invoice
- [ ] G1. Company name + tagline next to the logo (top right).
- [ ] G2. Service shown with the country (New Visa – UAE, OTB, Return Ticket).
- [ ] G3. Cancelled booking → invoice auto-cancelled (status in history).
- [ ] G4. Rename "Government Fee" → "Govt. fee / Airlines / Vendor fee"; no GST on it.
- [ ] G5. Visa Change fines / status-change charges go into that fee, not our service fee.
- [ ] G6. Service fee = total selling − total cost; GST only on the service fee.
- [ ] G7. Invoice number series per financial year: `TNS26/A01` (1 Apr 2026 – 31 Mar 2027), next year `TNS27/A…` (confirm exact format).

## H. Email template (sample image6)
- [ ] H1. Header: logo + name + tagline in one line, brand colours; remove "Explore the World".
- [ ] H2. Mobile layout fixed.
- [ ] H3. Signature "Team TripNexio"; remove the address.
- [ ] H4. "Need assistance?" block with phone, WhatsApp, email, website.
- [ ] H5. "This is an automated email. Please do not reply to this message." strip.
- [ ] H6. Social media icons.
- [ ] H7. Per-event images: request received, quote ready, visa approved, payment received; boarding-pass image for ticket / OTB.

## I. WhatsApp Meta account (client side)
- [ ] I1. Display name rejected — client sends the verified legal business name; we show "TripNexio is a brand of …" on the site; client resubmits.
- [ ] I2. Meta-approved message templates for notifications outside the 24h window.
