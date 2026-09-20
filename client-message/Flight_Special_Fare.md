# TripNexio — Flight Special Fare Module v1.0

**Scope:** Offline Special Fare Flight only  
**Channels:** Website + WhatsApp + CRM + Admin + Vendor  
**Important:** This is NOT an online flight-search/live inventory module.

## 1. Core Business Model

TripNexio sells offline Special Fares sourced through airline/vendor relationships and bulk/special purchasing.

There is:
- No public live flight search
- No public fare-watch
- No automatic live fare comparison
- No customer-facing live airline inventory
- Staff-controlled availability only

After a New Visa sale/journey, **Flight is the first upsell**. Return Ticket and OTB are separate subsequent services.

## 2. Sources

Flight can originate from:
- New Visa upsell
- Website direct
- WhatsApp
- Existing customer
- Referral
- Staff/CRM
- Other configured sources

CRM stores the source.

## 3. Customer Request

Collect:
- Departure Airport
- Destination Airport
- Travel Date
- Passengers

Maximum travel request window: **45 days**.

## 4. Airport Master

Admin-controlled:
- Add/Edit/Enable/Disable
- Airport name/code
- City/Country
- Region
- Display order
- Route availability

Phase 1:
- Major Indian airports offering direct India→UAE flights/special fares
- GCC airports

GCC: UAE, Saudi Arabia, Bahrain, Kuwait, Oman, Qatar.

No code change should be required to add/disable airports.

## 5. Airline Master

Admin-controlled:
- Airline name
- Airline code
- Country/region
- Logo
- Active/inactive
- Display order

Phase 1 includes Indian and GCC airlines.

Staff chooses airlines from the master list.

## 6. Passenger Flow

First ask:

**Existing Passenger / New Passenger**

Existing:
- Select existing passenger
- Ask whether to reuse the same passport details
- If yes, reuse valid data
- If no, request updated passport

New:
- Enter/upload required passenger information
- Passport OCR may extract details
- Customer reviews and confirms

## 7. Passenger Type

Calculate:

**DOB → Age on Travel Date → Passenger Type**

- Adult: 12+
- Child: 2–11
- Infant: under 2

Fare is calculated according to passenger type.

## 8. Flight Lead

Create Flight Lead after request submission.

CRM stores:
- Lead ID
- Customer
- Passenger(s)
- Source
- Departure
- Destination
- Travel Date
- Passenger type
- Mobile/email
- Created time
- Assigned staff
- Status

## 9. Staff Availability

Availability is **100% staff controlled** in Phase 1.

Staff checks Special Fare availability with airline/vendor/internal sources.

No live customer-facing search.

## 10. Quote Builder

Staff uses structured Quote Builder.

Flight:
- Airline
- Flight number
- Departure
- Arrival
- Travel date
- Departure/arrival time
- Baggage
- Fare type

Commercial:
- Vendor
- Vendor cost
- Adult fare
- Child fare
- Infant fare
- Selling price
- Margin
- Quote validity
- Vendor reference
- Booking deadline where applicable

Baggage is manually entered/selected.

CRM calculates:
**Selling Price − Vendor Cost = Margin**

Customer never sees vendor cost or margin.

## 11. Multiple Quotes

Staff may send multiple options.

When customer selects one:
- Selected option becomes active
- Other options close/expire
- Customer cannot accidentally pay another option

## 12. Alternative Route

If requested route is unavailable, staff can manually enter an alternative.

Example:
Requested: Jaipur→Dubai
Alternative: Delhi→Dubai

Customer must see:

> The requested Jaipur → Dubai route is not available. This is an alternative route from Delhi → Dubai.

The alternative must never appear as the original requested route.

## 13. Quote Validity

Maximum: **30 minutes**.

Admin can adjust the validity up to the 30-minute maximum.

Customer sees a countdown.

## 14. Quote Reminders

While valid, reminders are sent every **10 minutes**.

After expiry, reminders stop.

## 15. Expired Quote

Payment is blocked.

Show:
> This Special Fare quotation has expired.

Button:
**Request New Quote**

Staff reconfirms availability and generates a new quote.

Old quote cannot simply be reused.

## 16. Payment

Before payment show:
- Passenger
- Airline
- Flight
- Route
- Date/time
- Baggage
- Fare
- Total
- Expiry
- Terms
- Cancellation/refund policy

Payment is permitted only while quote is valid.

After payment:
**Payment Received**

Then final availability must be confirmed by staff/vendor.

## 17. Post-Payment Availability

Payment does not automatically mean ticket issued.

Staff confirms seat/fare.

### Available
Proceed to ticket issuance.

### Unavailable
Start Alternative Flow.

## 18. Alternative After Payment

If alternative is available:

### Higher fare
Show additional amount.

Buttons:
- Pay Additional Amount
- Request Refund

If accepted → additional payment → ticket issuance.

If rejected → refund.

### Lower fare
CRM calculates difference and processes applicable difference refund.

### No suitable alternative
Full refund.

Customer must never be forced into a higher fare.

## 19. Cancellation / Refund

Staff enters:
- Original paid amount
- Airline/vendor cancellation charge
- Applicable gateway charge

CRM calculates:

**Refund = Paid Amount − Vendor/Airline Cancellation Charge − Gateway Charge**

Record:
- Reason
- Fare rule
- Vendor
- Charges
- Refund amount
- Approval
- Status
- Date

## 20. Ticket Issuance

After final confirmation:
- Ticket number
- PNR/vendor reference
- Ticket issue time
- Ticket PDF
- Passenger
- Airline
- Flight
- Baggage

Status:
**Ticket Issued**

Deliver through WhatsApp and Email (and any configured customer channel).

## 21. Follow-up

Automatic follow-up every **7 days** until customer:
- Books
- Explicitly stops
- Opts out

Example:
Day 7, Day 14, Day 21, etc.

Default ownership stays with assigned staff; manager can reassign.

## 22. Upsell

New Visa → Flight first.

After flight booking/issuance:
- Return Ticket, where relevant
- OTB, where relevant

These remain separate service modules.

## 23. CRM

Dashboard statuses:
- New
- Availability Pending
- Quote Sent
- Quote Viewed
- Expiring
- Expired
- New Quote Requested
- Payment Pending
- Paid
- Final Confirmation
- Alternative Offered
- Additional Payment Pending
- Refund Pending
- Ticket Issued
- Cancelled
- Follow-up Due

CRM quote detail includes customer, passenger, requested route/date, quote options, vendor, cost, selling price, margin, expiry.

## 24. Admin

Admin controls:
- Airport Master
- Airline Master
- Pricing/fare configuration
- Vendor Master
- Quote validity (maximum 30 minutes)
- Reminder interval (10 minutes)
- Travel window (45 days)
- Follow-up interval (7 days)
- Refund/cancellation configuration
- Notification templates
- FAQ

## 25. Analytics — Phase 1

Track:
- Enquiries
- Quotes created/sent/viewed
- Quotes expired
- New quote requests
- Bookings
- Conversion %
- Average response time
- Average selling price
- Average margin
- Most requested routes
- Most requested departure airports
- Best vendors
- Staff conversion
- 7-day follow-up conversion
- Cancellations/refunds

## 26. FAQ

Website + WhatsApp + WhatsApp AI + CRM staff FAQ.

Categories:
- Special Fare
- Airports
- Airlines
- Passenger types
- Baggage
- Quotes
- Payment
- Alternative flights
- Cancellation/refund
- Follow-up
- Return Ticket
- OTB

WhatsApp AI must answer only from approved FAQ/knowledge.

## 27. Notifications

WhatsApp + Email:
- Request received
- Quote ready
- Quote reminder
- Quote expired
- New quote
- Payment received
- Final confirmation
- Alternative offered
- Additional payment
- Refund
- Ticket issued
- Follow-up

## 28. Audit Trail

Record:
- Source
- Customer/passenger
- Original request
- Alternative route
- Staff
- Vendor
- Quote
- Expiry/reminders
- Selection
- Payment
- Final availability
- Alternative
- Additional payment
- Refund
- Ticket
- Follow-ups
- Reassignment
- Notifications

## 29. Master Customer Journey

Flight Special Fare
↓
Route + Date + Passengers
↓
Existing / New Passenger
↓
Passport Reuse / New Details
↓
Lead Created
↓
Staff Checks Offline Special Fare
↓
Quote Builder
↓
Multiple Quote Options
↓
Customer Selects
↓
Maximum 30-Minute Quote Timer
↓
Payment
↓
Final Availability Confirmation
↓
Available?
├─ Yes → Ticket Issued
└─ No → Alternative
   ├─ Higher → Extra Payment / Refund
   ├─ Lower → Difference Refund
   └─ None → Full Refund
↓
Ticket Delivered
↓
Return Ticket Upsell
↓
OTB Check/Upsell

## 30. Locked Rules

1. Offline Special Fare only.
2. No online/live flight search.
3. Staff manually checks availability.
4. Airport and Airline Masters are Admin-controlled.
5. Phase 1 supports major direct India→UAE departure airports and GCC airports.
6. Maximum travel window: 45 days.
7. Quote validity: Admin-adjustable, maximum 30 minutes.
8. Quote reminder: every 10 minutes while valid.
9. Multiple quotes supported; selected quote closes others.
10. Expired quote blocks payment and requires a new/reconfirmed quote.
11. Existing passenger can reuse passport details.
12. Adult 12+, Child 2–11, Infant under 2, calculated from DOB on travel date.
13. Baggage is manual.
14. Alternative route is staff-entered and clearly labelled.
15. Payment requires a valid quote.
16. Final availability is confirmed after payment.
17. Higher alternative requires additional payment; customer may choose refund.
18. Lower alternative produces applicable difference refund.
19. No suitable alternative after payment = full refund.
20. Cancellation refund is calculated from paid amount minus applicable vendor/airline and gateway charges.
21. Follow-up every 7 days until customer stops/books.
22. Flight is first upsell after New Visa.
23. Return Ticket and OTB are separate modules.
24. No Fare Watch.
25. No public live fare comparison.
26. Vendor cost and margin are internal.
27. No invented availability or fare.

## 31. Open Decisions

Do not invent:
- Exact Phase 1 airport list
- Exact airline master list
- Exact default quote validity below 30 minutes
- Provider-specific gateway rules
- Airline/vendor-specific cancellation rules
- Exact ticketing/PNR operational process

These are Admin/configuration or implementation decisions to confirm before final lock.
