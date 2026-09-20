# TripNexio — UAE Visa Extension Journey

## Version 1.0 — Founder-Locked Working Specification

> Scope: UAE Visa Extension only. New Visa, Visa Change, Flight, OTB and Return/Onward Ticket are separate journeys.

## 1. Service Entry

Website:
**UAE Visa → New Visa | Visa Extension | Visa Change**

Footer also provides direct links to Visa Extension and Visa Change.

WhatsApp:
**UAE Visa → Visa Extension**

Customers can also type natural language such as “Mera visa extend karna hai.” The WhatsApp AI identifies the intent and starts the same Extension workflow.

## 2. Eligibility

TripNexio initially processes Visa Extension only for visas originally issued through TripNexio.

If no eligible TripNexio visa is found:

- If customer is inside UAE → recommend Visa Change / Manual Support.
- If customer is outside UAE → recommend New Visa.

No Extension Booking is created until an eligible TripNexio visa is identified.

Customer-facing message:

> We currently provide visa extension services only for visas issued through TripNexio.

## 3. Customer Identification

### Existing customer / registered mobile / same WhatsApp

The system identifies the Buyer and shows existing relevant passengers/visa records.

Example:

> Welcome back, Ahmed 👋  
> Which passenger's visa would you like to extend?

Options can include:

- Existing Passenger A
- Existing Passenger B
- - New Passenger

### New / unknown customer

Customer enters:

- Passport Number
- Date of Birth

The system searches TripNexio records.

## 4. Entry Date — Mandatory Starting Point

**Entry Date is mandatory for every Extension request.**

This applies to:

- Existing customers
- Existing passengers
- New customers
- Website
- WhatsApp

Even when the passenger is already known, the customer must provide/confirm the UAE Entry Date.

Prompt:

> Please confirm your UAE entry date.

Entry Date is the starting point for internal reminder/timeline calculations.

## 5. Visa Type and Estimated Timeline

The system uses the Visa Type available in the database:

- 30 Days
- 60 Days

It can internally calculate an estimated/reference timeline from:

**Entry Date + Visa Type**

This estimated date is used for reminder logic.

**Important:** The estimated date is NOT a verified legal visa expiry date and must not be presented to the customer as confirmed.

Actual expiry is manually checked by staff before exact expiry information is used for final Extension eligibility and quotation.

## 6. Pre-Extension Reminder

TripNexio may use Entry Date + Visa Type as an internal reminder signal.

Customer message:

> Your UAE visa may be approaching its extension window. Would you like us to check your extension eligibility?

Buttons:

- **Check Extension**
- **Not Now**

This is only a reminder/lead signal. It must not expose an unverified expiry date.

Reminder stops when:

- Customer completes Visa Extension
- Customer completes Visa Change
- Customer chooses Not Now / opts out
- Customer explicitly unsubscribes from extension reminders

## 7. Extension Lead

After customer shows interest:
**Extension Lead Created**

CRM creates an Extension Review Task.

Customer:

> Thank you. Your extension request has been received. Our team will review your visa details and get back to you shortly.

No final price/payment is generated before staff verification.

## 8. Staff Manual Verification

Staff checks:

- Current Visa Number
- Actual Visa Expiry Date
- Current Visa Status
- Original TripNexio Visa Booking
- Extension Eligibility
- Overstay/Fine
- Vendor/Sponsor

Customer does not see unverified expiry information.

## 9. Eligibility Rules

### Expired less than 30 days

May proceed to staff review, subject to applicable processing rules and fine/overstay handling.

### Expired 30 days or more

**Not eligible for the 30-day Extension**, even if the customer is willing to pay applicable overstay/fine.

Customer-facing message:

> ⚠️ Visa Extension Eligibility  
> If your visa has been expired for 30 days or more, you are not eligible for a 30-day Visa Extension, even if you are willing to pay any applicable overstay fine.

### Visa expires today

After staff verifies expiry = today:

- Mark case urgent.
- Payment must be completed within the available processing deadline.
- Operational deadline: **6:00 PM on the same working day**.
- If the next day is configured as a UAE or India holiday/non-working day, show an additional urgent warning.

Customer disclaimer:

> ⚠️ Your visa expires today. Payment must be completed within the available processing deadline. TripNexio will not be responsible for fines resulting from late payment.

Actual fine remains subject to verification and applicable authority rules.

## 10. Vendor / Sponsor

Vendor/Sponsor is mandatory for every TripNexio service.

Staff selects an Admin-created active Vendor/Sponsor.

Customer does not see internal Vendor/Sponsor information.

CRM records:

- Vendor/Sponsor
- Processing Cost
- Extension Fee
- Selling Price
- Margin
- Staff
- Date/Time

Historical bookings retain their commercial/vendor snapshot.

## 11. Pricing

Extension duration: **30 days only**.

Base Extension Fee:

- Fixed/configurable in Admin Panel.

Overstay/Fine:

- Entered manually by CRM staff.

Calculation:
**Extension Fee + Fine + Other Applicable Charges = Total**

Customer does not enter or calculate the fine.

## 12. Customer Summary

After staff verification and Vendor/Sponsor selection, customer receives:

- Passenger
- Passport
- Verified visa details
- Verified expiry
- Extension duration: 30 days
- Extension Fee
- Fine/Overstay, if applicable
- Other charges
- Total
- Payment deadline
- Applicable disclaimer
- Refund terms
- Relevant FAQ/help access

CTA:
**Pay Now**

## 13. Payment

Payment link validity: **24 hours**.

Reminders:

- WhatsApp
- Email

If link expires:
**Payment Link Expired → Lead remains in CRM → Staff can generate a new link.**

## 14. Payment Success

**Payment Received**
→ CRM updated
→ Staff notified
→ Extension processing starts
→ Vendor/Sponsor processing

Only successful payment starts paid Extension processing.

## 15. Additional Information / Documents

The Extension journey should not unnecessarily request the full New Visa checklist.

Existing eligible documents may be reused **only after customer confirmation**.

If staff/vendor requires anything:
**CRM Additional Request Task → WhatsApp + Email → Secure request/upload → Customer response → Staff verification → Processing continues**

Custom document requests are supported.

## 16. Existing Document Reuse

For returning passengers:

- Document age ≤ 3 months → **Use Existing / Upload New**
- Document age > 3 months → request new documents.

Never reuse a document without customer confirmation.

Retained Passport Front and Visa Copy may be offered for reuse after confirmation.

## 17. Processing Outcomes

### Successful

- New extended Visa Copy received
- Uploaded to CRM
- New Extension Booking ID
- WhatsApp + Email delivery
- Extension Completed

The new 30-day Extension validity is counted from the **original visa expiry date**.

### Not Accepted

If sponsor/authority does not accept the Extension for a processing/availability reason:
**Refund minus gateway charges**

CRM status: **Not Accepted**

### Rejected

Formal rejection:
**No refund**

CRM status: **Rejected**

Not Accepted and Rejected are separate statuses.

## 18. Refund Rules

**Not Accepted:** payment minus gateway charges.

**Rejected:** no refund.

Refund actions require CRM task and audit trail.

## 19. Extension Statuses

CRM lifecycle:

1. Extension Lead Created
2. Under Staff Review
3. Visa Verification Required
4. Eligibility Review
5. Vendor/Sponsor Selected
6. Quotation Ready
7. Payment Pending
8. Payment Received
9. Processing
10. Additional Information Required
11. Re-processing
12. Extended
13. Visa Delivered
14. Completed

Alternative outcomes:

- Not Eligible
- Not Accepted
- Rejected
- Cancelled
- Refund Processing
- Refund Completed

## 20. CRM Task Engine

Automatic tasks:

- Extension Lead → Extension Review Task
- Visa Verification → Manual Visa Verification Task
- Same-day expiry → Urgent Visa Extension Task
- Payment Pending → Extension Payment Follow-up
- Payment link expired → Generate New Extension Payment Link
- Additional information → Additional Information/Document Collection
- Vendor processing → Extension Processing
- Not Accepted → Extension Refund Review
- Rejected → Extension Rejection/Closure
- Refund → Accounts Refund Processing

Every task links to:

- Booking/Lead ID
- Passenger
- Service
- Task Type
- Priority
- Assigned Staff
- Due Date
- Status
- Reason
- Created By
- Created Time
- Activity History

## 21. Notifications

Channels:

- WhatsApp
- Email

Notifications include:

- Extension request received
- Review/update
- Quotation ready
- Payment link
- Payment reminders
- Payment received
- Additional information/document request
- Processing update
- Extension successful
- Not Accepted/refund information
- Rejection information
- Extended Visa copy

## 22. Day-25 Reminder

25 days after successful 30-day Extension:

> Your 30-day UAE Visa Extension is nearing expiry. Would you like to apply for another extension?

Buttons:

- **Apply Extension**
- **Not Now**

One reminder is sent.

Stop if customer does not engage, opts out, completes Visa Extension/Visa Change, or unsubscribes from extension reminders.

## 23. Website Journey

**UAE Visa → Visa Extension**

### Existing customer

Registered mobile identifies Buyer → select existing passenger/visa → confirm Entry Date → Extension Lead.

### New customer

Passport Number → DOB → confirm Entry Date → search TripNexio records → continue if eligible.

No customer login/password is required.

## 24. WhatsApp Journey

### Existing WhatsApp number

Identify Buyer → UAE Visa → Visa Extension → select existing passenger/visa → Entry Date → Extension request → staff verification.

### New WhatsApp number

UAE Visa → Visa Extension → Passport Number → DOB → Entry Date → search TripNexio → Extension request if eligible.

Free text is supported.

## 25. No-Match Routing

If Passport + DOB does not find an eligible TripNexio visa:

- Inside UAE → Visa Change / Manual Support
- Outside UAE → New Visa

No Extension Booking is created.

## 26. FAQ / Knowledge Base

Extension FAQs must cover:

- Eligibility
- TripNexio-issued visa requirement
- 30-day duration
- Entry Date
- 30/60-day source visa type
- Unverified vs staff-verified expiry
- Same-day expiry
- 6 PM operational deadline
- UAE/India holidays
- Fine/overstay
- 30+ days expired = not eligible
- Extension fee
- 24-hour payment link
- Expired payment link
- Not Accepted refund
- Rejected no-refund rule
- New 30-day validity from original expiry date
- Document reuse
- Additional documents
- Day-25 reminder

FAQ must clearly state:

> If the visa has been expired for 30 days or more, the customer is not eligible for the 30-day Extension, even if they are willing to pay the applicable overstay/fine.

FAQ is a global Admin-controlled TripNexio knowledge base and is available to:

- Website
- WhatsApp
- WhatsApp AI knowledge
- CRM staff assistance

Admin can add/edit/disable/delete, assign service/category, add keywords, set order, and publish/unpublish FAQs.

If WhatsApp AI is uncertain, it must not invent an answer and should offer human support.

## 27. CRM View

Extension CRM view shows:

### Header

- Lead/Booking ID
- Buyer
- Mobile
- Email
- Passenger
- Service
- Created Date
- Assigned Staff

### Visa

- Original Visa Booking ID
- Visa Number
- Verified Expiry Date
- Entry Date
- Visa Type
- Current Status

### Extension

- Duration: 30 days
- Extension Fee
- Fine
- Total
- Vendor/Sponsor
- Processing Cost
- Selling Price
- Margin

### Payment

- Payment Status
- Payment Link
- Link Expiry
- Gateway Status
- Refund Status

### Tasks

- Open tasks
- Priority
- Assigned Staff
- Due Date

### Documents

- Existing/reusable documents
- Customer confirmation
- Additional requests
- New documents

### Timeline

- Lead created
- Customer confirmation
- Entry Date
- Staff verification
- Vendor selection
- Quotation
- Payment
- Processing
- Outcome
- Visa delivery
- Notifications

## 28. Audit Trail

Record:

- Extension lead created
- Customer identified
- Entry Date submitted
- Visa record matched
- Staff verified visa
- Actual expiry entered/updated
- Eligibility decision
- Vendor selected
- Cost entered
- Extension fee applied
- Fine entered
- Quotation generated
- Payment link generated
- Payment received
- Additional request
- Document upload
- Processing started
- Not Accepted
- Rejected
- Refund decision
- Extended Visa uploaded
- Customer notified
- Reminder sent/stopped

## 29. Core Locked Decisions

1. Extension is a separate UAE Visa service.
2. Initially only TripNexio-issued visas are eligible.
3. Existing customer can select an existing passenger/visa.
4. New/unknown customer uses Passport Number + DOB.
5. **Entry Date is mandatory for every Extension request.**
6. Entry Date is the starting point for internal reminder/timeline calculations.
7. Database Visa Type (30/60 days) can be used for estimated internal reminder timing.
8. Estimated timing is not confirmed expiry.
9. Actual expiry is manually verified by staff.
10. Unverified expiry must not be shown as confirmed to customer.
11. Extension duration is 30 days only.
12. Visa expired <30 days can go to staff review.
13. Visa expired 30 days or more is not eligible.
14. Fine/overstay can be handled manually by CRM.
15. Extension Fee is Admin-configured.
16. Vendor/Sponsor is mandatory for every service.
17. Vendor/Sponsor is internal only.
18. Payment link is valid 24 hours.
19. WhatsApp + Email payment reminders.
20. Expired payment link remains in CRM and can be regenerated.
21. Same-day verified expiry is urgent.
22. Same-day operational deadline is 6 PM on the same working day.
23. UAE/India holiday/non-working calendars are Admin-configured.
24. Not Accepted → refund minus gateway charges.
25. Rejected → no refund.
26. Not Accepted and Rejected are separate.
27. New extended Visa copy is sent through WhatsApp + Email.
28. Extension has a new Booking ID linked to the original Visa Booking.
29. New 30-day validity is counted from original visa expiry date.
30. Day 25 after successful Extension → one WhatsApp + Email reminder.
31. Reminder stops after Extension, Visa Change, Not Now/opt-out, or unsubscribe.
32. Existing documents are reused only after customer confirmation.
33. Additional documents can be requested through CRM.
34. Website and WhatsApp use the same backend/CRM.
35. No customer login/password in Phase 1.
36. Extension FAQs are part of the global TripNexio FAQ/AI knowledge system.

## 30. Out of Scope

- New Visa detailed journey
- Visa Change detailed journey
- Flight / Special Offline Fare
- OTB
- Return/Onward Ticket
- Customer Portal/Login
- Full API architecture
- Database schema
- Deployment architecture

## 31. Status

**Document:** TripNexio — UAE Visa Extension Journey  
**Version:** 1.0  
**Status:** Founder-Locked Working Specification

Next module:
**Visa Change Journey**
