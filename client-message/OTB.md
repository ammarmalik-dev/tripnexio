# TripNexio — OTB (OK to Board) Module
## Final Business Requirements & Journey — v1.0

> **Status:** LOCKED BUSINESS RULES  
> **Purpose:** Source of truth for OTB website, WhatsApp, CRM, Admin and operations implementation.

---

## 1. What is OTB?

OTB (OK to Board) is an airline clearance process for applicable Gulf-bound travel.

TripNexio OTB rules:
- OTB service is for **Indian passport holders only**.
- **Do not ask nationality**.
- ECR passport holders may require OTB according to the selected airline's configured rule.
- ECNR passport holders do not require OTB.
- Some airlines do not require OTB, e.g. Emirates and Etihad.
- Admin controls the OTB requirement per airline and can enable/disable it without code changes.
- Customer-facing messaging must not claim that every Gulf-bound passenger universally requires OTB.
- TripNexio is an **official OTB partner**.

---

## 2. OTB Is an Upsell / Add-on

OTB is an upsell/add-on after:
- New UAE Visa sale
- Flight/ticket sale
- Existing customer interaction
- New customer interaction

Keep OTB linked to the parent customer/lead/booking whenever applicable.

---

## 3. Customer Entry

### New Customer
Ask:
1. Full Name
2. Mobile Number
3. Email
4. Airline
5. Travel Date

Do not ask nationality.

### Existing Customer
Use the registered customer record.

Ask whether the customer wants to use existing passport and visa details.

If YES:
- Do not ask passport again.
- Do not ask visa again.
- Do not ask name again.
- Do not ask nationality.

If flight was purchased elsewhere:
- Ask for flight ticket.
- Ask for return ticket.

If flight was purchased from TripNexio:
- Reuse the existing flight ticket.
- Ask only for return ticket.

If return ticket is missing:
- Offer TripNexio return-ticket booking.
- If accepted, calculate OTB + return ticket.
- Generate/link both bookings under the same customer/lead.

---

## 4. Airline Master

Customer selects an airline from a searchable list. No free-text airline entry.

The Airline Master must contain all relevant Indian airlines and all relevant GCC airlines from:
- UAE
- Saudi Arabia
- Qatar
- Bahrain
- Oman
- Kuwait

Admin can add/edit/enable/disable airlines without code changes.

Admin fields:
- Airline name
- Airline code
- Country/region
- Active/inactive
- OTB Required ON/OFF
- Normal OTB price
- Urgent OTB price
- Normal processing configuration
- Urgent processing configuration
- Working hours
- Required documents
- Airline-specific instructions
- Vendor/processing channel where applicable

Example:
- Emirates: OTB OFF
- Etihad: OTB OFF

These are configurable, not hard-coded.

---

## 5. OTB Requirement Check

Do not create a generic customer-facing “Eligibility Check”.

The system internally performs an **OTB Requirement Check** using:
- Indian passport scope
- ECR/ECNR information where available
- Selected airline
- Admin OTB ON/OFF rule
- Travel date/time
- Processing availability

If OTB is not required for the selected airline:
- Inform customer.
- Do not create a paid OTB application.

---

## 6. Documents

New customer / missing existing records:
- Passport front page
- Passport last page
- Valid UAE visa copy
- Flight ticket
- Return ticket

For existing customers, reuse stored passport and visa records.

If TripNexio already has the flight ticket, do not ask for it again.

---

## 7. Processing Type

Customer sees only:
- **Normal**
- **Urgent**

Do not show internal processing times, SLA, working hours, T+2, or 6–48 hour rules to the customer.

### Normal
Internally configured as T+2 working days.

### Urgent
Used for urgent cases. Same-day urgent can be offered when the internal requirement of at least 6 hours before departure and applicable working-hour rules are satisfied.

### Dynamic availability
- Travel tomorrow: suggest/show Urgent when Normal is not operationally possible.
- Travel 2+ days later: Normal can be available.
- Only show options that are actually available.

Admin controls:
- Normal ON/OFF
- Urgent ON/OFF
- Normal price
- Urgent price
- Processing rules
- Working hours
- Airline-specific availability

---

## 8. Pricing

Price depends on:
- Airline
- Processing type
- Admin-configured OTB rate

Customer sees the applicable price before payment.

CRM stores:
- OTB selling price
- Payment amount
- Payment status
- Parent booking/lead
- Return-ticket amount where applicable

---

## 9. Payment and Booking

Customer selects:
- Airline
- Travel date
- Normal/Urgent
- Return ticket if required/selected

System calculates payment.

Flow:
**Payment Link → Payment Successful → OTB Booking Generated**

CRM stores:
- Booking ID
- Customer ID
- Parent lead/booking
- Airline
- Travel date
- Processing type
- Amount
- Payment reference
- Documents
- Status history

---

## 10. Staff Verification

After booking generation:
**Staff Verification**

Staff checks:
- Customer details
- Passport
- Visa
- Flight ticket
- Return ticket
- Airline
- Travel date
- OTB requirement
- Processing type
- Payment

If anything is missing/incorrect:
**Documents Required**
→ CRM records missing item/reason
→ WhatsApp + HTML email notification
→ Customer uploads/corrects
→ CRM status: **Document Validation Pending**

---

## 11. Document Validation

Flow:
**Documents Received → Document Validation Pending → Staff Validation → Validated**

If invalid:
**Documents Required → Customer Notified → Customer Uploads → Document Validation Pending**

Do not forward incomplete/invalid documentation to the airline.

---

## 12. Airline Processing

Once documents are validated:
**Forward to Airline / OTB Processing**

CRM:
**Submitted to Airline → Airline Processing**

If airline asks for additional documents:
**Additional Documents Required → Customer notified → Upload → Document Validation Pending → Validate → Resubmit → Airline Processing**

---

## 13. Airline Approval

CRM:
**OTB Approved**

Staff records the OTB PNR/reference.

Customer receives WhatsApp + HTML email:

> **Your OTB PNR has been approved by the airline.**

Customer Portal updates to **OTB Approved**.

Then offer:
**Do you need a return ticket?**

If no return ticket exists, provide the return-ticket sales option.

---

## 14. Airline Rejection

CRM:
**OTB Rejected**

Customer receives WhatsApp + HTML email.

If the airline has already processed the application:
**No refund.**

---

## 15. TripNexio Unable to Process

This is different from airline rejection.

If TripNexio cannot process the application and it has not been processed by the airline:
**Unable to Process → Staff records reason → Customer notified → Refund Process**

Do not label this as airline rejection.

---

## 16. Cancellation / Refund

### Customer cancels before document validation
- Gateway charges are non-refundable.
- Refund applicable balance according to configured policy.

### Customer cancels after document validation
Deduct:
- ₹250 service charge
- Gateway charges

Refund remaining eligible amount.

### After airline processing
No refund whether airline approves or rejects.

### TripNexio cannot process
If before airline processing:
- Refund Process
- Staff records reason
- Customer notified

All calculations and decisions stored in CRM.

---

## 17. Customer Statuses

Keep customer statuses simple:
1. Application Started
2. Payment Pending
3. Payment Confirmed
4. Documents Required
5. Document Validation Pending
6. Processing
7. Submitted to Airline
8. Airline Processing
9. Additional Documents Required
10. OTB Approved
11. OTB Rejected
12. Completed
13. Cancelled
14. Refund Processing
15. Refund Completed

Do not expose complex internal operational statuses.

---

## 18. CRM Statuses

### Booking
- OTB Upsell Offered
- OTB Application Started
- Payment Pending
- Payment Successful
- OTB Booking Generated

### Verification
- Staff Verification Pending
- Documents Required
- Document Validation Pending
- Documents Validated

### Airline
- Ready for Submission
- Submitted to Airline
- Airline Processing
- Additional Documents Required
- OTB Approved
- OTB Rejected

### Exceptions
- OTB Not Required
- Unable to Process
- Cancelled
- Refund Processing
- Refund Completed

---

## 19. Separate Payment Status

Payment status is separate from OTB service status:
- Payment Pending
- Payment Successful
- Payment Failed
- Payment Expired
- Refund Pending
- Refund Completed

Example:
**OTB Status:** Airline Processing  
**Payment Status:** Paid

---

## 20. CRM Data

Store:
- Customer
- Parent lead/booking
- OTB booking ID
- Airline
- Processing type
- Travel date
- Passport reference
- Visa reference
- Flight ticket
- Return ticket
- Payment
- OTB PNR
- Submission timestamp
- Approval/rejection timestamp
- Airline response
- Missing documents
- Staff owner
- Refund details
- Complete activity/audit history

---

## 21. Notifications

WhatsApp + HTML email for:
- OTB application created
- Payment confirmation
- Documents required
- Document validation/action required
- Submitted to airline
- Additional documents required
- OTB approved
- OTB rejected
- Unable to process
- Refund initiated
- Refund completed

Customer Portal shows current status.

---

## 22. FAQ

FAQ must be available on Website, WhatsApp AI, Customer Portal and OTB page.

Topics:
- What is OTB?
- Who needs OTB?
- Is OTB required for ECR?
- Is OTB required for ECNR?
- Which airlines require OTB?
- Which airlines do not require OTB?
- Can I apply if I bought my flight elsewhere?
- Can an existing customer reuse passport and visa?
- What documents are required?
- Is return ticket required?
- Can TripNexio arrange return ticket?
- What is Normal OTB?
- What is Urgent OTB?
- Why do I only see one processing option?
- Can I apply close to departure?
- What happens if documents are missing?
- What happens if airline asks for additional documents?
- What happens if OTB is approved?
- What happens if OTB is rejected?
- What is cancellation/refund policy?
- What happens if TripNexio cannot process?

FAQ answers must follow this MD exactly.

---

## 23. Complete Journey

```text
New Visa / Flight Sale / Customer
            ↓
        OTB Upsell
            ↓
           Apply
            ↓
    Existing Customer?
       /                YES            NO
      ↓              ↓
Use Existing      New Customer
Passport/Visa     Details + Documents
      \              /
       \            /
        Airline Selection
              ↓
         Travel Date
              ↓
     OTB Requirement Check
              ↓
        OTB Required?
        /                NO            YES
      ↓              ↓
Inform Customer   Normal/Urgent
No OTB Payment    Availability
                     ↓
               Price Calculation
                     ↓
                Payment Link
                     ↓
              Payment Successful
                     ↓
              Booking Generated
                     ↓
              Staff Verification
                     ↓
               Missing Docs?
                 /                      YES        NO
                ↓          ↓
         Documents       Validate
           Required          ↓
                ↓       Documents Validated
           Customer           ↓
            Upload       Submit to Airline
                ↓             ↓
       Validation Pending   Processing
                ↓          /                    Validate   Approved   Rejected
                ↓          ↓          ↓
          Submit Again   OTB PNR    No Refund
                           ↓
                    Notify Customer
                           ↓
                   Offer Return Ticket
```

---

## 24. Locked Business Rules

1. OTB is an upsell/add-on.
2. OTB is for Indian passport holders only.
3. Do not ask nationality.
4. ECR may require OTB according to airline configuration.
5. ECNR does not require OTB.
6. Admin controls airline OTB ON/OFF.
7. Airline list is searchable and Admin-maintained.
8. Normal and Urgent are customer-facing options.
9. Customer does not see internal processing time.
10. Travel tomorrow should suggest/show Urgent when Normal is not operationally possible.
11. Travel 2+ days later can show Normal when available.
12. Existing customers can reuse passport and visa.
13. TripNexio-booked flight does not need to be uploaded again.
14. Return ticket is required; TripNexio can sell it if missing.
15. Payment success generates the OTB booking.
16. Staff verifies documents after booking generation.
17. Missing documents trigger customer notification.
18. Uploaded corrections return to Document Validation Pending.
19. Validated documents are forwarded for airline processing.
20. Airline approval produces an OTB PNR/reference.
21. Approved OTB is communicated through WhatsApp and HTML email.
22. Airline rejection after processing is non-refundable.
23. Customer cancellation before validation: gateway charge is non-refundable.
24. Customer cancellation after validation: ₹250 + gateway charge deducted.
25. TripNexio unable to process before airline processing: refund process.
26. All service/payment/refund actions are recorded in CRM.

---

## 25. Admin Controls

Admin can configure without code changes:
- Airline Master
- Airline active/inactive
- OTB Required ON/OFF
- Normal OTB price
- Urgent OTB price
- Normal availability
- Urgent availability
- Working hours
- Required documents
- Airline instructions
- Return-ticket rules
- Refund/cancellation settings
- FAQ content
- Notification templates
- WhatsApp templates
- Email templates

---

## 26. Implementation Principle

OTB shares common TripNexio infrastructure:
- Customer database
- CRM
- Payment gateway
- Document storage
- OCR/document validation
- WhatsApp
- Email
- Customer Portal
- Notifications
- Audit log
- Admin masters

OTB business rules remain modular and independently configurable.
