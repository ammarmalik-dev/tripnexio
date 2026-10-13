# Client doc 2026-10-14: Home, Special Fare, OTB, Return Ticket

Source: `client-message/doc/TripNexio Project.docx`. That file holds live credentials, so it is never committed.

The client said the other sections of the doc will be checked tomorrow. This list covers only the four sections they updated, plus the extra request in chat:

> Do not set a time limit on the OTB, Return Ticket and New Visa payment links.

## General
- [ ] G1. No expiry on direct payment links for OTB, Return Ticket and New Visa.
- [ ] G2. "Pay Now" / "Download" buttons instead of bare links, in email and WhatsApp, for all services.
- [ ] G3. Confirmation email and WhatsApp mention the passenger count, departure and arrival city, and travel date.

## Home
- [ ] H1. Remove the hero background text.
- [ ] H2. Hero: Explore Services and Track Status fit on one line on mobile.
- [ ] H3. Bottom CTA ("Ready to simplify your journey?"): both buttons on one line on mobile.
- [ ] H4. The two-colour "TripNexio" logo name is used everywhere: website, CRM and Admin.

## Special Fare
- [ ] S1. "What You'll Need": replace the passport and visa copy items with:
  - "Passport / Government ID": A valid passport or govt-issued photo ID accepted by the airline.
  - "Visa Copy": Required only when applicable for the destination.
- [ ] S2. WhatsApp bot airports:
  - Show the airport name for a code.
  - Validate against the Airport master and reject invalid entries.
  - Accept a code, airport name or city. If several airports match, the customer chooses one.
- [ ] S3. Each quote option shows: airline name, flight number, departure/arrival city, departure/arrival date and time, baggage, fare type, quote validity, and Booking ID / reference.
- [ ] S4. The issued ticket shows: PNR / ticket number, passenger details, airline, flight details, baggage, and the ticket PDF.
- [ ] S5. T&C before payment (Domestic and International) and the "Booking Confirmation" checkbox text.
- [ ] S6. "Important Information" block in the body of the ticket-issued email (Domestic and International).
- [ ] S7. CRM quotation form cleanup:
  - Reuse the lead's airports, date and passengers.
  - Search inside the Departure and Arrival fields; no separate search bar.
  - Direct / Connecting choice.
  - Departure and Arrival terminal.
  - Cancellation allowed, cancellation charge, no-show charge, and optional cancellation terms.
  - Vendor cost and selling price per adult / child / infant.
  - Remove: reporting time, restrictions, vendor reference, charge basis, time condition, airline fare inside price, and the separate policy text.
  - Multiple independent quotes per lead.
  - Validity kept, with no second deadline.
  - Non-refundable fares are shown clearly.

## Return Ticket
- [ ] R1. The customer receives two WhatsApp confirmations; send only one.
- [ ] R2. Vendor rates for Return Ticket and OTB by vendor, country, airline and processing type.
- [x] R3. WhatsApp bot: passenger count only, then names and passports. Done 2026-10-14, commit a141fbf.
- [ ] R4. T&C before payment, checkbox and "Accept & Proceed to Payment" button.
- [ ] R5. "Please Verify Your Details" / disclaimer block in the reservation-issued email.
- [ ] R6. "Return Ticket Booking: create the booking directly after they select the required option. AFTER I NEED> NOT NOW BUTTON NEED TO DISABLE." Unclear; see the notes in the code changes.

## OTB
- [ ] O1. Destination country first, then only the airlines Admin enabled (priced) for that country, on both the website and the WhatsApp bot.
- [ ] O2. Remove the passport, visa and ticket copy uploads from the lead form; documents come after payment.
- [ ] O3. Airlines master: remove the OTB requirement columns and keep TAT management.
- [ ] O4. Express only when the 8-working-hour TAT can be met before departure.
- [ ] O5. T&C before payment, checkbox and "Accept & Proceed to Payment" button.
