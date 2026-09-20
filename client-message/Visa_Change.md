# TripNexio — Visa Change Journey v3.0

## A2A Airport / Border Exit Master Flow

**Status:** Draft for review  
**Scope:** Visa Change only

---

## 1. Core Principle

Visa Change has two exit methods:

1. ✈️ Airport-to-Airport (A2A)
2. 🚌 Land Border Exit

The customer must **not manually enter airport names**.

Airport/entry/exit points are selected from controlled system data or from staff-configured CRM options.

For A2A, the system must support airport selection from **UAE and GCC airports** configured in Admin.

For Border Exit, the CRM must support **Admin/Staff-configured land border names and operational pickup details**.

---

# 2. Customer Entry

Customer selects:

**UAE Visa → Visa Change**

Then:

### Choose Visa Change Method

- ✈️ Airport-to-Airport
- 🚌 Border Exit

---

# 3. Basic Customer Details

Customer enters:

- Full Name
- Passport Number
- Visa Last Date
- Mobile Number
- Email

Customer does NOT enter airport names.

Customer can select:

**+ Add Another Passenger**

For each passenger:

- Full Name
- Passport Number
- Visa Last Date
- Nationality
- Adult / Child

---

# 4. A2A Flow

If customer selects:

**Airport-to-Airport (A2A)**

The customer should NOT be asked to type:

- Entry airport
- Exit airport
- Airport name

Instead, airport information is controlled by the system/CRM.

## A2A Airport Master

Admin maintains an airport master containing:

- Airport Name
- Airport Code
- Country
- City
- UAE/GCC classification
- Active/Inactive
- Available for A2A Entry
- Available for A2A Exit
- Display Order

The system should support UAE and GCC airports.

### UAE countries/markets to support

- United Arab Emirates
- Saudi Arabia
- Bahrain
- Kuwait
- Oman
- Qatar

The exact airport list should be maintained through the Admin Airport Master rather than hard-coded in the customer UI.

This allows airports to be added, edited, disabled or expanded later without changing the application.

---

# 5. A2A Entry / Exit Point

For A2A, CRM/staff can select:

### Entry Point

Airport from the configured airport master.

### Exit Point

Airport from the configured airport master.

Customer only sees the confirmed operational option after CRM availability is updated.

Customer does not type airport names.

---

# 6. A2A Availability

Lead is created first.

Staff checks Sponsor/Vendor availability.

Staff then enters/updates CRM:

- Entry Airport
- Exit Airport
- Airline
- Flight
- Date
- Time
- Reporting Time
- Vendor/Sponsor
- Cost
- Selling Price
- Margin
- Package information

Only confirmed availability is shown to the customer.

---

# 7. Border Exit Flow

If customer selects:

**Border Exit**

Customer does NOT need to enter the land border name.

Staff/CRM selects the applicable border from the configured Border Master.

---

# 8. Land Border Master

Admin maintains:

- Border Name
- Country/Side
- UAE-side location
- Destination-side location
- Active/Inactive
- Available for Visa Change
- Display Order
- Vendor/Sponsor
- Notes

Example structure:

**Border Name**
→ Pickup Location
→ Drop/Border Location
→ Available Date
→ Available Time

The system must allow Admin/Staff to add new border names without code changes.

---

# 9. Border Pickup Information

For every confirmed Border package, CRM must capture:

### Mandatory

- Border Name
- Pickup Location
- Reporting Time
- Departure/Travel Time
- Customer Contact Number
- Pickup Person Name

Where operationally applicable, CRM may also store:

- Pickup Person Contact Number
- Drop Location
- Bus/Operator
- Vehicle/Service details
- Vendor/Sponsor

### Customer UI

Customer should NOT have to enter:

- Border name
- Pickup location
- Pickup person
- Contact number

These are supplied by CRM after availability is confirmed.

---

# 10. Border Package

After customer selects the confirmed Border option, the final package must show:

- Border Name
- Pickup Location
- Pickup Person Name
- Pickup Contact Number
- Reporting Time
- Departure/Travel Time
- Drop/Border Location
- Bus/Operator
- Passenger Details
- Booking ID
- Instructions

### Mandatory operational information

**Pickup Location — Mandatory**

**Reporting Time — Mandatory**

**Pickup Person Name — Mandatory**

**Customer Contact Number — Mandatory**

The package must not be generated if mandatory operational details are missing.

---

# 11. Nationality & Document Checklist

After nationality is available:

Show the applicable Admin-configured document checklist.

Do NOT show final pricing at this stage.

Example:

- Passport
- Passport Photo
- Additional nationality-specific documents

Existing valid documents can be reused from Customer 360.

Actual upload happens after payment.

---

# 12. Lead Generation

After basic passenger information is submitted:

**Visa Change Lead Created**

CRM stores:

- Lead ID
- Customer
- Passenger(s)
- Mobile
- Email
- Passport Number
- Visa Last Date
- Nationality
- Adult/Child
- A2A / Border
- Lead Source
- Required Documents
- Created Date/Time

---

# 13. Sponsor/Vendor Availability

Staff checks with the relevant Sponsor/Vendor.

### A2A

Staff confirms:

- Entry Airport
- Exit Airport
- Airline
- Flight
- Date
- Time
- Reporting Time
- Vendor/Sponsor
- Cost
- Selling Price
- Margin

### Border

Staff confirms:

- Border Name
- Pickup Location
- Pickup Person
- Pickup Contact Number
- Reporting Time
- Departure/Travel Time
- Drop/Border Location
- Vendor/Sponsor
- Cost
- Selling Price
- Margin

---

# 14. No Customer Airport/Border Entry

Customer does NOT manually enter:

- Airport name
- Airport code
- Border name
- Pickup location
- Pickup person
- Pickup contact number

These are operational fields controlled by CRM/Admin.

The customer only chooses from confirmed options presented by TripNexio.

---

# 15. Customer Availability Notification

Before confirmation:

> Our team is checking availability. We'll notify you once confirmed.

After CRM confirmation:

> Your Visa Change options are now available. Please select your preferred date and package.

---

# 16. Customer Package Selection

### A2A

Customer sees:

- Entry Airport
- Exit Airport
- Airline
- Flight
- Date
- Time
- Reporting Time
- Package details

### Border

Customer sees:

- Border Name
- Pickup Location
- Pickup Person
- Pickup Contact Number
- Reporting Time
- Travel Time
- Drop/Border Location
- Package details

Customer selects one confirmed package.

---

# 17. Pricing

Final pricing appears only after:

1. Sponsor/Vendor availability is confirmed.
2. Customer selects the confirmed date/time/package.

Pricing may depend on:

- A2A / Border
- Nationality
- Adult / Child
- Passenger count
- Selected package
- Admin-configured rate
- Applicable charges

Passenger-wise calculation:

Adult — Indian — ₹XXXX  
Adult — Indian — ₹XXXX  
Child — Indian — ₹XXXX

Then:

Subtotal  
Charges  
Total Payable

---

# 18. Terms & Conditions

After package selection and final pricing:

Customer accepts:

- Terms & Conditions
- Refund Policy
- Visa Approval Disclaimer
- Legal/Immigration Disclaimer
- Overstay/Fine Disclaimer where applicable

Mandatory checkbox:

**☐ I agree to the Terms & Conditions**

---

# 19. Payment

Customer receives payment link.

After successful payment:

**Payment Received**

Then:

**Booking ID Generated**

Example:

`TNX-VC-XXXXXX`

---

# 20. Document Upload

After successful payment:

Customer uploads only required/missing documents.

Nationality-based checklist remains the source.

Existing valid documents can be reused.

CRM verifies documents.

Statuses:

- Required
- Missing
- Received
- Verified
- Rejected

---

# 21. Package Generation

Package is generated only when:

- Payment received
- Required operational details complete
- Required documents/processing conditions complete

### A2A PDF

Must contain:

- Entry Airport
- Exit Airport
- Airline
- Flight
- Date
- Time
- Reporting Time
- Passenger
- Booking ID
- Instructions

### Border PDF

Must contain:

- Border Name
- Pickup Location
- Pickup Person
- Pickup Contact Number
- Reporting Time
- Travel Time
- Drop/Border Location
- Bus/Operator
- Passenger
- Booking ID
- Instructions

---

# 22. Exit Completed

Customer does NOT upload exit receipt/proof.

Staff manually updates:

**Exit Completed**

CRM records:

- Exit date/time
- Exit method
- Airport/Border
- Staff
- Notes
- Audit history

---

# 23. New Visa Processing

After Exit Completed:

**New Visa Processing**

Existing customer/passenger data is reused.

If Sponsor/Embassy/Immigration requests additional documents:

**Additional Document Required**

Customer uploads the requested document.

---

# 24. Visa Result

### Approved

- New UAE Visa PDF
- WhatsApp
- Email
- Customer Portal

Status:

Visa Approved
→ Visa Delivered
→ Completed

### Rejected

Customer is notified.

Visa approval is subject to the relevant authority.

TripNexio does not guarantee approval.

---

# 25. CRM Status Flow

Lead Created
↓
Availability Check
↓
Availability Confirmed
↓
Customer Notified
↓
Date/Time/Package Selected
↓
Payment Pending
↓
Payment Received
↓
Booking ID Generated
↓
Documents Pending
↓
Documents Received
↓
Documents Verified
↓
Package Generated
↓
Exit Pending
↓
Exit Completed
↓
New Visa Processing
↓
Additional Documents if required
↓
Visa Approved / Rejected
↓
Visa Delivered
↓
Completed

---

# 26. Admin Controls

## Airport Master

Admin can:

- Add airport
- Edit airport
- Disable airport
- Set UAE/GCC classification
- Set Entry availability
- Set Exit availability
- Set display order
- Add airport code
- Add city/country

## Border Master

Admin can:

- Add border
- Edit border
- Disable border
- Set country/side
- Set UAE-side location
- Set destination-side location
- Set availability
- Add notes

## Vendor/Sponsor

Admin can configure:

- Vendor/Sponsor
- Service
- Cost
- Selling Price
- Margin

## Pricing

Admin can configure:

- A2A Adult
- A2A Child
- Border Adult
- Border Child
- Nationality-wise pricing
- Applicable charges

## Documents

Admin can configure:

- Nationality
- Required documents
- Optional documents
- Active/Inactive

---

# 27. FAQ

FAQ must include:

### A2A

- What is A2A?
- Which airports are supported?
- Can I select any airport?
- How are Entry and Exit airports selected?
- Who confirms the airport and flight?
- What is the reporting time?

### Border

- What is Border Exit?
- Which borders are available?
- Can I choose my own border?
- Where is the pickup location?
- Who is the pickup person?
- What is the pickup contact number?
- What is the reporting time?

### Documents

- What documents are required?
- Does nationality affect documents?
- Can existing documents be reused?
- When do I upload documents?

### Pricing

- When will I see the price?
- Does nationality affect price?
- Does Adult/Child affect price?

### Payment

- When is the payment link generated?
- When is Booking ID generated?

### Package

- What information is included in the package?
- Will I receive a PDF?
- Where can I find the pickup information?

### Exit / New Visa

- Do I need to upload exit proof?
- What happens after Exit Completed?
- When does new Visa Processing start?
- Can additional documents be requested?

---

# 28. Customer 360

One customer can have:

- Multiple bookings
- Multiple passengers
- Multiple services

Visa Change uses the common TripNexio Customer 360.

Do not create a separate customer database.

---

# 29. Important Locked Rules

1. Visa Change has A2A and Border Exit.
2. Customer does not manually enter airport names.
3. Customer does not manually enter border names.
4. A2A airport data comes from Admin Airport Master / CRM.
5. Airport Master supports UAE and GCC airports.
6. Border data comes from Admin/CRM Border Master.
7. Customer does not enter pickup location.
8. Customer does not enter pickup person.
9. Customer does not enter pickup contact number.
10. Border pickup location is mandatory for package generation.
11. Border reporting time is mandatory for package generation.
12. Pickup person name is mandatory for package generation.
13. Customer contact number is mandatory in the operational package/CRM.
14. Nationality determines the document checklist.
15. Checklist can appear before availability.
16. Final pricing does not appear before confirmed availability.
17. Lead is generated before availability checking.
18. Staff checks Sponsor/Vendor availability.
19. Customer sees only CRM-confirmed options.
20. Customer chooses confirmed date/time/package.
21. Final rate appears after package selection.
22. Payment occurs after Terms and Summary.
23. Actual document upload occurs after payment.
24. Existing valid documents may be reused.
25. Customer does not upload exit proof.
26. Staff manually marks Exit Completed.
27. New Visa Processing begins after Exit Completed.
28. Additional documents can be requested by the authority.
29. Visa approval is not guaranteed.
30. Do not invent availability, prices, airport/border data, documents or SLA.
31. Visa Change must remain separate from Visa Extension, OTB and Return Ticket.

---

# 30. Final Customer Journey

Visa Change
↓
A2A / Border
↓
Name + Passport Number + Visa Last Date + Mobile + Email
↓
Add Passenger
↓
Nationality
↓
Document Checklist Appears
↓
Lead Generated
↓
Staff Checks Sponsor/Vendor
↓
A2A: Entry/Exit Airport + Flight confirmed
OR
Border: Border + Pickup + Contact + Reporting Time confirmed
↓
Customer Notified
↓
Customer Chooses Confirmed Date/Time/Package
↓
Rate + Full Details
↓
Terms & Conditions
↓
Final Summary
↓
Payment
↓
Booking ID
↓
Document Upload
↓
CRM Verification
↓
Package Generated
↓
Exit
↓
Exit Completed
↓
New Visa Processing
↓
Additional Documents if required
↓
Visa Approved / Rejected
↓
Visa Delivered
↓
Completed
