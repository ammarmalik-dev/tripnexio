# TripNexio — UAE New Visa Journey
## Version 1.1 — Founder-Locked Business, Customer, CRM & Protection Plan Journey

> **Scope:** New UAE Visa only.
> Visa Extension, Visa Change, Flight, OTB and Return/Onward Ticket journeys are separate and will be designed later.

---

# 1. Core Customer Model

## Buyer / Customer
- No username/password.
- No customer login in Phase 1.
- Mobile number + email are mandatory for a new application.
- One mobile number can create multiple bookings.
- One buyer can book for multiple families and different people.

## Passenger
Buyer and Passenger are separate entities.

One booking can contain:
- One passenger
- Multiple passengers
- Multiple adults
- Multiple children

Each passenger has separate:
- DOB
- Adult/Child classification
- Documents
- Pricing
- Validation
- Protection Plan eligibility/status

---

# 2. Booking Structure

Every successful paid application receives a unique **Booking ID**.

Structure:

Buyer
→ Journey/Case
→ Booking
→ Passenger(s)
→ Service
→ Documents
→ Payment
→ Visa Status
→ Protection Plan Status
→ CRM Tasks
→ Timeline/Audit

A single buyer can have unlimited/multiple bookings and families.

A new service such as future Visa Extension or Visa Change will receive a **new Booking ID**.

---

# 3. Customer Channels

## Website

Phase 1 website:
- Service selection
- New Visa booking
- Buyer mobile/email collection
- Passenger collection
- DOB and parent relationship
- Expected Travel Date
- Normal/Express
- Protection Plan
- Final quotation
- Payment
- Document upload

No website AI assistant in Phase 1.

Website has a WhatsApp button for conversational assistance.

## WhatsApp

WhatsApp supports:
- Greeting + buttons
- Free/random text
- New booking
- Status tracking
- Document upload
- Payment links
- Document requests
- Notifications
- Visa delivery

Website and WhatsApp use the same backend, CRM and booking engine.

---

# 4. WhatsApp Greeting

After greeting, Admin-controlled buttons can appear:

- UAE Visa
- Flights
- OTB
- Return Ticket
- Track Booking
- Other / Ask Anything

Admin can add, remove/disable, rename and reorder services.

Disabled services must not appear in customer-facing menus or AI recommendations.

Protection Plan is not a separate menu item. It appears contextually in the Visa flow before payment.

---

# 5. New Visa Website Flow

1. Select UAE Visa
2. Select New Visa
3. Enter Mobile Number + Email
4. Select number of Adults and Children
5. Enter passenger details
6. DOB-based Adult/Child classification
7. Parent linking for children
8. Select Expected Travel Date
9. Select Normal or Express
10. Protection Plan offer
11. Final quotation
12. Terms acceptance
13. Payment
14. Payment success
15. Booking ID created
16. Document upload
17. OCR
18. Staff validation
19. Embassy submission
20. Embassy review
21. Additional document request if required
22. Re-validation/re-submission
23. Approved / Rejected
24. Visa PDF delivery
25. Protection Plan workflow if applicable
26. Visa journey completed

---

# 6. Family Rules

Under 18 years = Child.

Child:
- Must have at least one parent in the same booking.
- Parent must be linked to the child.
- System must show the parent requirement disclaimer.
- Child cannot proceed without a parent.

Suggested disclaimer:

> Applicants under 18 years must apply with at least one parent.

Adult/Child pricing is separate.

---

# 7. Expected Travel Date

Expected Travel Date is mandatory and selected during application.

Current business rule:
- Normal: minimum planned travel timeline = 7 days
- Express: minimum planned travel timeline = 3 days

Processing timeline uses Admin-controlled:
- Working days
- Non-working days
- Holidays
- Special holidays

If documents are pending, automated reminders continue daily and the operational timeline remains governed by the configured working-day calendar.

---

# 8. Protection Plan

Protection Plan is offered after processing selection and before payment.

## Passenger-wise

Protection Plan is per eligible passenger.

Example:
- 3 eligible passengers = ₹5,000 × 3
- 2 eligible passengers = ₹5,000 × 2
- Ineligible passenger = no Protection Plan option

Default reference price: ₹5,000, configurable by Admin.

## Mandatory Acceptance

Before purchase:
- Full applicable conditions are displayed.
- Customer must agree.
- Agreement is mandatory.
- Without agreement the Protection Plan cannot be purchased.
- Accepted terms are stored with the Booking ID.

## Eligibility

Configured conditions include:
- Fresh/first-time passport
- No relevant GCC travel history
- No relevant legal/immigration issue
- No applicable fine/penalty
- No false/forged/misleading information
- Other configured exclusions

OCR can flag possible issues, but OCR is not the final decision-maker.

Flow:
OCR Flag
→ CRM Review Task
→ Staff Review
→ Protection Plan Decision

If later found ineligible:
- Protection Plan may be cancelled/rejected according to accepted terms.
- Visa application continues normally.

---

# 9. Protection Plan Status

Protection Plan is linked to the **same Booking ID** as the Visa.

It is also tracked **passenger-wise**.

Possible statuses:

1. Not Offered
2. Offered
3. Selected — Terms Pending
4. Terms Accepted
5. Purchased
6. Under Eligibility Review
7. Eligible
8. Ineligible
9. Cancelled
10. Refund Under Review
11. Refund Approved
12. Refund Rejected
13. Refund Processing
14. Refund Completed

The Protection Plan status is shown alongside the Visa status inside the same booking.

---

# 10. Visa Status

Customer-facing and CRM statuses should be understandable while CRM can maintain detailed operational states.

Core Visa statuses:

1. Application Started
2. Payment Pending
3. Booking Confirmed
4. Documents Pending
5. Documents Under Verification
6. Additional Documents Required
7. Application Submitted
8. Under Embassy Review
9. Visa Approved
10. Visa Rejected
11. Visa Delivered
12. Application Cancelled
13. Completed

Detailed CRM processing states may include:
- Draft
- Payment Pending
- Payment Received
- Documents Pending
- Documents Received
- OCR / Validation
- Staff Verification
- Ready for Submission
- Submitted to Embassy
- Embassy Reviewing
- Additional Document Requested
- Customer Upload Pending
- Re-validation
- Re-submitted
- Approved
- Rejected
- Visa PDF Delivered
- Completed

---

# 11. Booking Status View

All important statuses are connected to the same Booking ID.

Example:

## Booking: TNX-001245

### Visa
**Under Embassy Review**

### Protection Plan
**Purchased / Under Eligibility Review**

### Payment
**Paid**

### Documents
**Verified**

### Embassy
**Reviewing**

### Tasks
**No customer action pending**

### Timeline
Full activity history.

For a family booking, Protection Plan status is displayed per passenger.

Example:

| Passenger | Visa | Protection Plan |
|---|---|---|
| Adult 1 | Under Review | Purchased |
| Adult 2 | Under Review | Eligible |
| Child 1 | Under Review | Not Purchased |
| Child 2 | Under Review | Refund Under Review |

---

# 12. CRM Task Engine

Important customer/operational events must create CRM Tasks.

Tasks are linked to:
- Booking ID
- Passenger
- Service
- Task Type
- Priority
- Assigned Staff
- Due Date
- Status
- Reason
- Activity/Audit Log

## Examples of automatic tasks

### Payment
Payment Pending
→ Payment Follow-up Task

### Documents
Missing document
→ Document Collection Task

### OCR
OCR mismatch
→ Manual Verification Task

### Passport validity
Passport < 6 months
→ New Passport Request Task

### Protection Plan
Potential eligibility issue
→ Protection Plan Review Task

### Embassy
Ready for submission
→ Embassy Submission Task

### Embassy additional document
→ Additional Document Collection Task

### Visa rejection + Protection Plan
→ Protection Plan Refund Review Task

### Refund approved
→ Accounts Refund Processing Task

### Visa approved
→ Visa Delivery/Customer Notification Task where operationally required

Every task should be visible in CRM and linked to the same Booking ID.

---

# 13. Draft Application

Before payment:

Draft Application
→ Payment Pending
→ CRM visible
→ Staff cannot process the Visa
→ WhatsApp payment reminder

Only after successful payment:
Payment Success
→ Booking ID
→ Visa workflow starts

---

# 14. Final Summary

Before payment customer must see:
- Buyer mobile
- Buyer email
- Passenger list
- Adult/Child
- Visa type/duration
- Expected Travel Date
- Normal/Express
- Passenger-wise prices
- Protection Plan per eligible passenger
- Total payable
- Applicable terms

Customer accepts applicable terms before payment.

---

# 15. Document Checklist

Default New Visa checklist:

1. Passport Front Page
2. Passport Last Page
3. Passport Photo

Admin can:
- Add
- Remove/disable
- Edit
- Reorder
- Mark required/optional

The checklist is reflected in:
- Website
- WhatsApp
- CRM
- Customer upload requests

## Embassy Additional Documents

There is no fixed Embassy-only document list.

Staff can create any custom request:
- Document name
- Reason/instruction

---

# 16. Passenger-wise Documents

Each passenger has an independent document set.

Example:

Booking TNX-001245

Adult 1:
- Passport Front
- Passport Last
- Photo

Adult 2:
- Passport Front
- Passport Last
- Photo

Child 1:
- Passport Front
- Passport Last
- Photo

Documents are linked:
Buyer → Booking → Passenger → Document

---

# 17. Returning Passenger Documents

If a passenger appears in a future booking:

### Document age ≤ 3 months
Ask customer:

**Use Existing / Upload New**

Do not automatically reuse without customer confirmation.

### Document age > 3 months
Request new documents.

Retained Passport Front and Visa Copy can be offered for reuse after customer confirmation.

---

# 18. Document Replacement

If staff requests a new passport:
- Old passport file is deleted
- New passport becomes active

If staff requests a new photo:
- Old photo file is deleted
- New photo becomes active

Old sensitive files are not retained.

---

# 19. Passport Validity

OCR reads passport expiry date.

If passport validity is within 6 months:
- Warn customer during application
- Do not automatically block customer
- Create CRM flag/task
- Staff can request a new passport

---

# 20. OCR / Validation

OCR:
- Reads passport information
- Reads DOB
- Reads expiry
- Flags potential mismatch
- Flags potential Protection Plan issues

OCR is an assistance layer.

Final operational validation is performed by authorized staff.

Mismatch:
OCR/Customer Data Mismatch
→ CRM Flag
→ Staff Review
→ Correction or New Document Request if required

---

# 21. Document Request Engine

Used for:
- Initial missing documents
- Wrong/rejected documents
- Embassy additional documents

Flow:

CRM Request
→ WhatsApp + Email
→ Secure Upload Link
→ Daily Reminder
→ Customer Upload / Staff Manual Receipt
→ OCR/Validation
→ Staff Verification
→ Reminder Stops
→ CRM Status Update
→ Re-submit to Embassy where required

Reminder automatically stops when:
- Customer uploads
- Staff receives/verifies
- Staff closes/cancels request

WhatsApp uploaded documents are automatically linked to:
WhatsApp Number → Buyer → Booking → Passenger → Document Request

Staff verification remains mandatory.

---

# 22. Embassy Workflow

Validated documents:
→ Ready for Submission
→ Embassy Submission
→ Embassy Reviewing

If Embassy requests anything:
→ Custom CRM Document Request
→ Customer Notification
→ Upload
→ Validation
→ Re-submit
→ Embassy Reviewing

Final:
- Approved
- Rejected

---

# 23. Visa Approval

Visa Approved:
- CRM Visa status = Approved
- Visa PDF stored
- WhatsApp notification
- Email notification
- Visa journey completed
- Next Best Service Engine activated

Potential next services are separate journeys:
- Special Offline Fare
- Return/Onward Ticket
- OTB

---

# 24. Visa Rejection

Visa Rejected:
- CRM status = Rejected
- WhatsApp notification
- Email notification
- Rejection reason recorded if available

If Protection Plan purchased:
→ Protection Plan Refund Review Task
→ Staff review
→ Manager/Admin decision
→ Accounts refund if approved
→ Customer notification

Visa rejection does not automatically mean Protection Plan refund.

---

# 25. Cancellation / Refund Policy

Cancellation window starts from successful payment timestamp.

### Within 4 hours
Full refund minus gateway charges.

### After documents are validated
Refund = ₹250 deduction + gateway charges.

### After Embassy submission
No refund.

### Unable to submit to Embassy
If submission cannot proceed because of duplicate file or another submission issue:
₹250 deduction + gateway charges.

All refunds/cancellations require CRM task and audit records.

---

# 26. Additional Charges

Additional charges stay under the existing Booking ID.

Flow:
CRM
→ Additional Charge
→ Reason
→ Amount
→ Payment Link
→ Customer Pays
→ Same Booking Updated

No new lead or new Booking ID is created for an additional charge.

---

# 27. Document Retention

After 3 months:
- Keep Passport Front Page
- Keep Visa Copy/PDF
- Auto-delete other customer-uploaded document files

Customer/Buyer/Passenger/Booking history remains.

Approved Visa PDF is retained as a TripNexio service output.

---

# 28. Customer Tracking via WhatsApp

Customer can type:
**Track Status**

If one booking:
→ show booking status.

If multiple bookings:
→ show selectable bookings by Booking ID/passenger/service.

Example:
- TNX-001245 — Ahmed — UAE Visa
- TNX-001310 — Family — UAE Visa
- TNX-001401 — Sara — UAE Visa

Customer selects a booking and receives:
- Visa status
- Protection Plan status
- Payment status
- Document status
- Embassy status
- Required customer action
- Latest timeline update

---

# 29. CRM Booking View

Every Booking ID should have a consolidated view:

### Booking Header
- Booking ID
- Buyer
- Mobile
- Email
- Service
- Booking Date
- Assigned Staff

### Visa
- Current status
- Processing type
- Expected Travel Date
- Embassy status
- Approval/rejection

### Protection Plan
- Overall status
- Passenger-wise status
- Purchase amount
- Eligibility
- Refund status

### Passengers
- Passenger details
- Adult/Child
- Parent relationship
- Documents
- Validation

### Payments
- Original payment
- Gateway status
- Additional charges
- Refunds

### Tasks
- Open tasks
- Assigned staff
- Due dates
- Priority

### Timeline
- All actions
- Notifications
- Uploads
- Requests
- Status changes
- Staff actions
- Audit events

---

# 30. Important Locked Principles

1. No customer login in Phase 1.
2. Mobile + Email mandatory.
3. One mobile can have multiple bookings and families.
4. Buyer and Passenger are separate.
5. One booking can contain multiple passengers.
6. Adult/Child is DOB-based.
7. Under-18 requires a parent.
8. Adult/Child pricing is separate.
9. Protection Plan is passenger-wise.
10. Protection Plan is linked to the same Booking ID.
11. Protection Plan has its own passenger-wise status.
12. Visa and Protection Plan statuses are shown together under one Booking ID.
13. Successful payment creates Booking ID.
14. Payment-pending applications cannot be processed.
15. Standard document checklist is Admin-controlled.
16. Embassy can request any custom document.
17. OCR assists; staff makes final operational decisions.
18. Missing-document reminders are automatic.
19. Website and WhatsApp share the same backend/CRM.
20. WhatsApp supports buttons and free text.
21. Additional charges stay under the same Booking ID.
22. Important operational events create CRM Tasks.
23. All important actions have an audit trail.
24. Visa Extension, Visa Change, Flight, OTB and Return Ticket are separate journeys.
25. New Visa is locked before those journeys are designed.

---

# 31. Status

**Document:** TripNexio — UAE New Visa Journey  
**Version:** 1.1  
**Status:** Founder-Locked Working Specification

Next:
1. Founder review
2. Final Visa Journey lock
3. Master Blueprint update
4. Design Visa Extension
5. Design Visa Change
6. Design Flight Journey
7. Design OTB Journey
8. Design Return/Onward Ticket Journey
