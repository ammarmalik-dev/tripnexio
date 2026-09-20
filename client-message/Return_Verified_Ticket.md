# TripNexio — Return Verified Ticket
## Flight Ticket Module — Business Requirements & Customer Journey v1.0

> **Status:** LOCKED BUSINESS RULES  
> **Module:** Flight Ticket → Return Verified Ticket  
> **Purpose:** Source of truth for Website, WhatsApp, Customer Portal, CRM and Admin implementation.

---

# 1. Module Position

TripNexio service architecture:

```text
UAE VISA
├── New Visa
├── Visa Extension
└── Visa Change

FLIGHT TICKET
├── Special Fare
└── Return Verified Ticket

OTB
└── Separate Service / Module
```

**Return Verified Ticket is a service under Flight Ticket.**

**OTB is separate and must not be merged into Return Verified Ticket.**

---

# 2. Product

Return Verified Ticket is a **UAE-focused, online-verifiable return/onward ticket reservation service**.

The service is intended to provide proof of onward/return travel where applicable.

Customer-facing communication must not guarantee that every airline, immigration authority or border officer will accept the reservation.

The reservation must be genuinely verifiable through the configured vendor/airline process.

---

# 3. Who Can Book

**Anyone can book from any supported source.**

Possible sources:
- Website
- WhatsApp
- Staff / CRM
- Existing TripNexio customer journey
- New Visa journey
- Flight Special Fare journey
- OTB journey

The service is also available as an upsell.

---

# 4. Upsell Relationships

Return Verified Ticket can be offered after:

### New Visa

```text
New Visa
↓
Flight Special Fare / relevant flight service
↓
Return Verified Ticket
```

### Flight Special Fare

```text
Flight Special Fare
↓
Return Verified Ticket
```

### OTB

```text
OTB
↓
Return Verified Ticket
```

If the customer opts out of Return Verified Ticket from a particular journey:

```text
Offer
↓
Customer Opts Out
↓
Stop Return Verified Ticket Upsell
```

Do not repeatedly push the same Return Verified Ticket offer during the same journey.

---

# 5. Customer Details

Customer provides:

- Name
- Number of passengers
- Visa Type
- Travel Date

## Visa Type

Customer selects:

- 30 Days
- 60 Days

## Travel Date

Customer selects **only the travel date**.

The customer does **not** select the return/onward date.

---

# 6. Return / Onward Date

The return/onward date is generated according to:

- Selected UAE visa type
- Travel date
- Configured TripNexio business rule
- Vendor/airline reservation rules

### 30-Day Visa

System generates the applicable onward/return reservation according to the configured 30-day rule.

### 60-Day Visa

System generates the applicable onward/return reservation according to the configured 60-day rule.

The exact date calculation must be configurable rather than hard-coded if Admin needs to change the operational rule.

---

# 7. Reservation Timing & Validity

Locked business rules:

- Reservation can be issued **up to 24 hours before travel**.
- Once issued, the reservation is intended to be **valid for the next 24 hours**.
- Actual reservation validity remains subject to the configured vendor/airline reservation system.
- CRM should store issue time and expected expiry time.
- Staff should be able to see the internal expiry information.

Customer does not need to see internal operational calculations unless required by the final customer-facing terms.

---

# 8. Existing Customer

If the customer already exists:

System checks the customer profile.

Reuse available:
- Name
- Passport
- Visa
- Existing customer information

Only ask for missing information/documents.

Do not make the customer upload information that is already valid and available in the customer record unless the service requires an updated copy.

---

# 9. New Customer

New customer provides the required information and documents.

Required customer information:
- Name
- Number of passengers
- Visa type
- Travel date

Required documents:
- Passport copy
- UAE Visa copy
- Required onward/return ticket information where applicable

---

# 10. Customer Flow

```text
Return Verified Ticket
        ↓
Name
        ↓
Number of Passengers
        ↓
Visa Type
30 / 60 Days
        ↓
Travel Date
        ↓
Existing Customer?
      /         YES      NO
     ↓        ↓
Reuse       Collect
existing    required
data        data/docs
      \      /
       \    /
        ↓
     Price Calculation
        ↓
Terms & Conditions
        ↓
Summary
        ↓
Payment
        ↓
Booking Generated
        ↓
Documents Required
        ↓
Document Validation Pending
        ↓
Documents Validated
        ↓
Forwarded to Airline / Vendor
        ↓
NO REFUND
        ↓
Ticket / Reservation Processing
        ↓
Ticket Issued
        ↓
Staff Uploads PDF to CRM
        ↓
Customer Notification
        ↓
Customer Portal
        ↓
Completed
```

---

# 11. Pricing

Admin controls the selling price.

The system should support:
- Price per passenger
- Adult price
- Child price
- Infant price if applicable
- Package pricing where required

If the business uses the same price for all passenger types, Admin can configure the same rate.

The final price is shown before payment.

---

# 12. Terms & Conditions

Before payment, customer sees:

- Service summary
- Passenger count
- Visa type
- Travel date
- Applicable price
- Reservation purpose
- Important validity information
- Cancellation/refund policy
- Airline/immigration disclaimer

Customer must explicitly accept the Terms & Conditions before payment.

Recommended customer-facing disclaimer:

> Return/onward reservations are provided according to the selected travel details and configured vendor availability. Airline schedules, immigration decisions, denied boarding, cancellations, rescheduling and other travel decisions remain outside TripNexio's control. Customers are responsible for complying with applicable airline, visa and immigration requirements.

Do not promise guaranteed boarding, immigration admission or visa approval.

---

# 13. Payment

Flow:

```text
Customer Details
↓
Price
↓
Terms & Conditions
↓
Summary
↓
Payment Link
↓
Payment Successful
↓
Booking Generated
```

Payment status must be stored separately from service status.

Payment statuses:
- Payment Pending
- Payment Successful
- Payment Failed
- Payment Expired
- Refund Pending
- Refund Completed

---

# 14. Booking Generation

After successful payment:

**Return Ticket Booking Generated**

CRM creates:
- Booking ID
- Customer ID
- Parent lead/booking if applicable
- Passenger count
- Visa type
- Travel date
- Selling price
- Payment reference
- Documents
- Staff owner
- Status history

The booking is not considered completed merely because payment was successful.

---

# 15. Document Flow

After booking generation:

```text
Booking Generated
↓
Documents Required
↓
Customer Uploads / Existing Documents Retrieved
↓
Document Validation Pending
↓
Staff Validation
```

If documents are incomplete or incorrect:

```text
Documents Required
↓
Customer Notification
↓
Customer Uploads Corrected Documents
↓
Document Validation Pending
```

Do not forward an incomplete application to the airline/vendor.

---

# 16. Forwarding Stage

Once documents are validated:

```text
Documents Validated
↓
Forwarded to Airline / Vendor
↓
Ticket / Reservation Processing
```

This is the critical operational cutoff.

## 🔒 NO REFUND AFTER FORWARDING

Once:
1. Documents are validated, and
2. The request is forwarded to the airline/vendor,

the booking becomes **non-refundable**.

This applies even if the ticket/reservation has not yet been issued.

---

# 17. Cancellation & Refund

## Before Documents Are Validated

Customer may request cancellation.

Applicable refund:
- Gateway charges are deducted / non-refundable.
- Remaining eligible amount can be refunded according to the configured refund policy.

## After Documents Are Validated and Forwarded

**NO REFUND.**

```text
Documents Validated
↓
Forwarded to Airline/Vendor
↓
NO REFUND
```

## After Ticket Issuance

**NO REFUND.**

Ticket issuance does not create a new refund eligibility window.

---

# 18. Vendor / Airline Processing

CRM stores:

- Vendor name
- Vendor cost
- Selling price
- Margin
- Request time
- Vendor reference
- PNR / reservation reference where available
- Issue time
- Expiry time
- Staff owner

Admin should support multiple vendors.

Staff can select the appropriate vendor according to availability/operational rules.

---

# 19. Ticket Issuance

Staff/vendor completes the reservation.

Staff:
1. Receives the ticket/reservation PDF.
2. Verifies the reservation/reference where applicable.
3. Uploads the PDF to CRM.
4. Updates the booking status.
5. Delivers it to the customer.

CRM status:

**Ticket Issued**

---

# 20. Customer Delivery

Customer receives:

- Return Verified Ticket PDF
- WhatsApp notification
- HTML email
- Customer Portal update

Example WhatsApp message:

> Your Return Verified Ticket has been issued. Your ticket PDF is available in this chat and your TripNexio account.

The exact template is configurable from Admin.

---

# 21. Completion

Final flow:

```text
Ticket Issued
↓
PDF Uploaded to CRM
↓
Customer Notified
↓
Customer Portal Updated
↓
Completed
```

CRM should store the delivery timestamp.

---

# 22. Flight / Airline Disruption Disclaimer

If the customer's flight is:
- Rescheduled
- Cancelled
- Delayed
- Denied boarding
- Affected by airline operational changes
- Affected by immigration/border decisions

TripNexio is not responsible for those external decisions, subject to applicable law and the final agreed Terms & Conditions.

Customer must comply with airline, visa and immigration requirements.

---

# 23. Customer Statuses

Customer-facing statuses:

1. Application Started
2. Payment Pending
3. Payment Confirmed
4. Documents Required
5. Document Validation Pending
6. Processing
7. Ticket Issued
8. Completed
9. Cancelled
10. Refund Processing
11. Refund Completed

Keep customer-facing statuses simple.

---

# 24. CRM Statuses

Detailed CRM lifecycle:

```text
Return Ticket Upsell Offered
↓
Application Started
↓
Payment Pending
↓
Payment Successful
↓
Booking Generated
↓
Documents Required
↓
Document Validation Pending
↓
Documents Validated
↓
Forwarded to Airline / Vendor
↓
Ticket / Reservation Processing
↓
Ticket Issued
↓
Delivered
↓
Completed
```

Exception statuses:
- Customer Cancellation
- Refund Processing
- Refund Completed
- Unable to Process
- Vendor Issue
- Expired Reservation

---

# 25. Notifications

Send WhatsApp + HTML email where applicable for:

- Booking created
- Payment successful
- Documents required
- Document validation required
- Documents validated
- Forwarded to airline/vendor
- Ticket issued
- Ticket delivered
- Cancellation
- Refund initiated
- Refund completed
- Processing exception

Customer Portal must show the current status and issued PDF.

---

# 26. Website Journey

```text
Flight Ticket
↓
Return Verified Ticket
↓
Name
↓
Number of Passengers
↓
Visa Type: 30 / 60 Days
↓
Travel Date
↓
Existing Customer?
↓
Reuse / Collect Details
↓
Price
↓
Terms & Conditions
↓
Summary
↓
Payment
↓
Booking Generated
↓
Documents
↓
Validation
↓
Processing
↓
Ticket Issued
↓
PDF Delivered
```

---

# 27. WhatsApp Journey

WhatsApp AI must provide the same service.

```text
WhatsApp
↓
Flight Ticket
↓
Return Verified Ticket
↓
Identify Existing Customer
↓
Reuse Existing Records
↓
Ask Missing Details
↓
Visa Type
↓
Travel Date
↓
Price
↓
Terms & Conditions
↓
Payment
↓
Documents
↓
Status Updates
↓
Ticket PDF
```

The AI must use CRM/Admin data and must not invent:
- Prices
- Vendor availability
- Ticket status
- PNR
- Reservation validity
- Approval
- Refund eligibility

---

# 28. Admin Controls

Admin should control:

## Pricing
- Adult price
- Child price
- Infant price
- Package price
- Effective price settings

## Vendors
- Vendor Master
- Active/inactive
- Vendor cost
- Selling price
- Margin
- Vendor reference

## Reservation Rules
- 30-day visa rule
- 60-day visa rule
- Issue window
- Reservation validity
- Vendor-specific validity

## Documents
- Required document list
- Document rules
- Optional/mandatory settings

## Terms
- Cancellation policy
- Refund policy
- Disclaimer
- Customer T&C

## Notifications
- WhatsApp templates
- HTML email templates
- Customer Portal messages

## FAQ
Admin can maintain Return Verified Ticket FAQ content.

No code change should be required for normal configuration.

---

# 29. FAQ

FAQ must be available on:
- Website
- WhatsApp AI
- Customer Portal
- Return Verified Ticket page

Topics:
- What is a Return Verified Ticket?
- Why do I need an onward/return ticket?
- Is this for UAE travel?
- Can anyone book it?
- Can an existing customer reuse documents?
- What documents are required?
- Can I select the return date?
- What is the difference between 30-day and 60-day visa?
- When can the ticket be issued?
- How long is the reservation valid?
- When will I receive the PDF?
- Can I cancel?
- What happens if I cancel before document validation?
- What happens after documents are forwarded to the vendor?
- Is there a refund after forwarding?
- What happens if the airline changes/cancels my flight?
- What happens if I am denied boarding?
- Is boarding or immigration approval guaranteed?

FAQ answers must follow this MD and the configured Admin rules.

---

# 30. Audit Trail

CRM must record:
- Customer
- Booking ID
- Parent booking/lead
- Passenger count
- Visa type
- Travel date
- Documents received
- Validation decision
- Validation timestamp
- Staff member
- Forwarding timestamp
- Vendor
- Vendor cost
- Selling price
- Margin
- Vendor reference
- PNR/reservation reference
- Ticket issue timestamp
- Ticket upload timestamp
- Customer delivery timestamp
- Cancellation timestamp
- Refund calculation
- Refund timestamp
- Status history

---

# 31. Complete Business Flow

```text
                   RETURN VERIFIED TICKET
                             ↓
                    Customer / Upsell
                             ↓
                          Details
                             ↓
                   Existing Customer?
                    /                                YES               NO
                   ↓                 ↓
             Reuse Records      New Details
                    \              /
                     \            /
                       Visa Type
                       30 / 60
                           ↓
                      Travel Date
                           ↓
                         Price
                           ↓
                  Terms & Conditions
                           ↓
                        Summary
                           ↓
                        Payment
                           ↓
                   Booking Generated
                           ↓
                   Documents Required
                           ↓
               Document Validation Pending
                           ↓
                    Documents Validated
                           ↓
             Forwarded to Airline / Vendor
                           ↓
                      🔒 NO REFUND
                           ↓
                  Ticket Processing
                           ↓
                    Ticket Issued
                           ↓
                  PDF Uploaded to CRM
                           ↓
              WhatsApp + Email + Portal
                           ↓
                       COMPLETED
```

---

# 32. Locked Business Rules

1. Return Verified Ticket is under **Flight Ticket**.
2. OTB is a separate service and is not under Return Verified Ticket.
3. Service is UAE-focused.
4. Anyone can book from any supported source.
5. Customer enters name, passenger count, visa type and travel date.
6. Visa type is 30 Days or 60 Days.
7. Customer selects only the travel date.
8. Customer does not select the return/onward date.
9. Return/onward date is generated according to the configured visa-type rule.
10. Reservation can be issued up to 24 hours before travel.
11. Reservation validity is intended to be 24 hours after issuance, subject to vendor/airline rules.
12. Existing customer data should be reused.
13. New customer provides required information/documents.
14. Passport copy and UAE visa copy are required where not already available.
15. Payment is required before processing.
16. Booking is generated after successful payment.
17. Staff validates documents.
18. Invalid/missing documents trigger customer notification and re-upload.
19. Validated documents are forwarded to the airline/vendor.
20. **Once documents are validated and forwarded to the airline/vendor, NO REFUND.**
21. Ticket issuance is also non-refundable.
22. Before forwarding, cancellation may follow gateway-fee deduction rules.
23. Staff uploads the issued PDF to CRM.
24. Customer receives PDF through WhatsApp, HTML email and Customer Portal.
25. Airline schedule changes, cancellations, denied boarding and immigration decisions are outside TripNexio's control, subject to applicable law/T&C.
26. Admin controls pricing, vendors, reservation rules, documents, T&C, FAQ and notifications.
27. CRM keeps complete audit history.
28. Customer opt-out stops the Return Verified Ticket upsell for the current journey.
29. Website and WhatsApp must use the same CRM/Admin rules.
30. Do not invent or silently change any business rule.

---

# 33. Implementation Principle

Return Verified Ticket must use shared TripNexio infrastructure:

- Customer database
- CRM
- Payment gateway
- Document storage
- WhatsApp
- HTML email
- Customer Portal
- Admin
- Vendor management
- Audit log

But Return Verified Ticket remains a distinct service with its own:
- Pricing
- Documents
- Processing
- Refund cutoff
- Statuses
- Vendor flow
- Customer journey

Do not merge its business rules with Flight Special Fare or OTB.
