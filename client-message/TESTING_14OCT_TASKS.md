# Client doc 2026-10-14: Home, Special Fare, OTB, Return Ticket

Source: `client-message/doc/TripNexio Project.docx`. That file holds live credentials, so it is never committed.

The client said the other sections of the doc will be checked tomorrow. This list covers only the four sections they updated, plus the extra request in chat:

> Do not set a time limit on the OTB, Return Ticket and New Visa payment links.

## General
- [x] G1. No expiry on direct payment links for OTB, Return Ticket and New Visa. — done (5073c39)
- [x] G2. "Pay Now" / "Download" buttons instead of bare links, in email and WhatsApp, for all services. — done (5073c39)
- [x] G3. Confirmation email and WhatsApp mention the passenger count, departure and arrival city, and travel date. — done (5073c39)

## Home
- [x] H1. Remove the hero background text. — done (a249764)
- [x] H2. Hero: Explore Services and Track Status fit on one line on mobile. — done (a249764)
- [x] H3. Bottom CTA ("Ready to simplify your journey?"): both buttons on one line on mobile. — done (a249764)
- [x] H4. The two-colour "TripNexio" logo name is used everywhere: website, CRM and Admin. — done (a249764)

## Special Fare
- [x] S1. "What You'll Need": replace the passport and visa copy items with: — done (7423c5d)
  - "Passport / Government ID": A valid passport or govt-issued photo ID accepted by the airline.
  - "Visa Copy": Required only when applicable for the destination.
- [x] S2. WhatsApp bot airports: — done (4fa292c)
  - Show the airport name for a code.
  - Validate against the Airport master and reject invalid entries.
  - Accept a code, airport name or city. If several airports match, the customer chooses one.
- [x] S3. Each quote option shows: airline name, flight number, departure/arrival city, departure/arrival date and time, baggage, fare type, quote validity, and Booking ID / reference. — done (7423c5d (city names + itinerary; reference in the page header))
- [x] S4. The issued ticket shows: PNR / ticket number, passenger details, airline, flight details, baggage, and the ticket PDF. — done (7423c5d)
- [x] S5. T&C before payment (Domestic and International) and the "Booking Confirmation" checkbox text. — done (7423c5d)
- [x] S6. "Important Information" block in the body of the ticket-issued email (Domestic and International). — done (7423c5d)
- [x] S7. CRM quotation form cleanup: — done (7423c5d)
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
- [x] R1. The customer receives two WhatsApp confirmations; send only one. — done (5073c39 (bot reply only, with Pay Now))
- [x] R2. Vendor rates for Return Ticket and OTB by vendor, country, airline and processing type. — done (17cf012)
- [x] R3. WhatsApp bot: passenger count only, then names and passports. Done 2026-10-14, commit a141fbf.
- [x] R4. T&C before payment, checkbox and "Accept & Proceed to Payment" button. — done (7423c5d)
- [x] R5. "Please Verify Your Details" / disclaimer block in the reservation-issued email. — done (7423c5d)
- [x] R6. "Return Ticket Booking: create the booking directly after they select the required option. AFTER I NEED> NOT NOW BUTTON NEED TO DISABLE." Unclear; see the notes in the code changes. — done (d7a8388 ("I need one" adds it; no "Not now"))

## OTB
- [x] O1. Destination country first, then only the airlines Admin enabled (priced) for that country, on both the website and the WhatsApp bot. — done (add2acb)
- [x] O2. Remove the passport, visa and ticket copy uploads from the lead form; documents come after payment. — done (already: the form has no uploads, documents after payment)
- [x] O3. Airlines master: remove the OTB requirement columns and keep TAT management. — done (add2acb)
- [x] O4. Express only when the 8-working-hour TAT can be met before departure. — done (add2acb (optional departure time))
- [x] O5. T&C before payment, checkbox and "Accept & Proceed to Payment" button. — done (7423c5d)
