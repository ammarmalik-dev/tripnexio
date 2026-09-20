# TRIPNEXIO CRM — FUNCTIONAL MASTER DOCUMENT
**Version:** 1.0  
**Status:** CRM Figma / Architecture Reference  
**Purpose:** Define the TripNexio CRM staff application as the operational counterpart to the TripNexio Admin Functional Master Document.

---

# 1. PLATFORM MODEL

TripNexio consists of three connected applications:

1. **Website / Customer Portal** — customer-facing acquisition, quotation, payment, documents and updates.
2. **CRM** — staff operational workspace.
3. **Admin** — configuration, permissions, roster, pricing, vendors and governance.

Core principle:

> **Admin controls/configures. CRM operates. Website serves the customer.**

CRM and Admin are separate applications with separate access/authentication, while communicating through shared APIs/platform services and a shared business/data model.

CRM must consume Admin configuration rather than duplicate Admin configuration controls.

---

# 2. CRM PURPOSE

CRM is the daily operational workspace for staff.

CRM must allow staff to:

- Create and manage Leads
- Create and manage Quotations
- Generate payment links
- Process paid bookings
- Manage Customers
- Manage passengers/PAX
- Upload and validate documents
- Use OCR/extraction results
- Process service-specific workflows
- Select configured vendors
- Communicate with customers
- Raise refunds
- Manage operational follow-ups
- View reports
- Use Knowledge Base / FAQ
- Use Help
- View operational timelines
- Use AI-assisted drafting/summaries where enabled

CRM staff must not control global Admin configuration.

---

# 3. CRM NAVIGATION

Recommended navigation:

## Command Centre
- Sales Overview
- Operations Overview
- Most Action Required
- Charts / operational graphics
- Calendar period filter

## Sales
- Leads
- Customers
- Quotations

## Operations
- Bookings
- Refunds
- Follow-ups
- Delay Analysis

## Resources
- Vendors
- Knowledge Base / FAQ

## Analytics
- Reports

## Communication
- Notifications
- WhatsApp
- Email

## Help
- Need Help

## Profile
- Profile
- Change Password
- Security Question
- Logout

---

# 4. COMMAND CENTRE

Command Centre answers:

> **What is happening in sales and operations, and what needs action now?**

Keep the page compact.

## Header

Show:

- Welcome back
- Staff name
- Current date/context
- Notification button
- Sound control if enabled by final design

Do not use a notification bell icon.

## Period filter

Use a calendar/date picker supporting:

- Any custom start date
- Any custom end date
- Random/custom period

The selected period must persist when opening/closing records.

## Sales Overview

Possible KPIs/graphics:

- New Leads
- Hot Leads
- Warm Leads
- Cold Leads
- Qualified Leads
- Quotations
- Accepted Quotations
- Conversion
- Payment Pending
- Payment Received

## Operations Overview

Possible operational KPIs:

- Active Bookings
- Documents Pending
- Customer Action Required
- Staff Action Required
- External Processing
- Delayed
- Refunds Raised
- Completed

Do not create separate attention sections for Payment, Refund, Hold or Delay.

## Most Action Required

This is the primary operational queue.

Examples:

- Client accepted quotation → Create Booking
- New booking arrived → Process
- Customer documents uploaded → Validate
- Document rejected → Review
- Customer response required
- Refund raised → Follow up / Admin decision
- Visa approved → Upload/confirm visa
- Ticket ready → Issue/process
- OTB action required
- Follow-up due
- Delay requires action

Each action opens the relevant Lead/Booking.

Do not call this Recent Bookings.

Do not add a separate Operational Queue.

---

# 5. LEADS

Lead is the pre-payment / pre-booking operational record.

## Lead fields

Common fields:

- Lead ID
- Customer
- Contact details
- Lead type
- Lead temperature
- Service
- Sub-service
- Country
- PAX
- Adult count
- Child count
- Travel / required date
- Source
- Staff handling record where applicable
- Quotation
- Payment link
- Documents
- Timeline

Lead temperature:

- Cold
- Warm
- Hot

## Lead ID

Lead ID is generated immediately.

When payment is successfully received and the lead converts:

> **Lead ID becomes Booking ID**

Do not generate a second unrelated Booking ID.

Lead timeline must carry forward into Booking timeline.

---

# 6. LEAD CREATION

Lead form must be service-specific.

Do not use one generic form for all services.

The selected Service/Sub-service determines which fields appear.

## New Visa

Show relevant:

- Country
- Visa type
- PAX
- Travel/required date
- Passenger information
- Required documents

## Visa Change

Support configured journey types such as:

### A2A
- Airline
- Flight number
- Entry/exit airport
- Departure/arrival date and time
- Reporting time
- Package

### Border
- Pickup location
- Pickup person
- Pickup contact
- Reporting date/time
- Travel time
- Package

## Visa Extension

Show:

- Current visa number
- Current visa last date / expiry
- Extension required date
- PAX
- Applicable configured pricing

## OTB

Show:

- Airline
- Flight
- PNR where available
- Travel date
- PAX
- Processing type: Normal / Urgent

## Return Verified Ticket

Show:

- Travel/return requirement
- Travel date
- PAX
- Linked OTB relationship where purchased together

## Flight / Special Fare

Show:

- Origin
- Destination
- Travel date
- Passenger count
- Quotation/fare requirements

---

# 7. LEAD PAYMENT

After Lead creation staff can:

- Generate payment link
- Apply permitted employee coupon
- Upload staff/customer documents
- Edit lead before payment
- Raise full refund
- Raise passenger-level partial refund where applicable

## Payment gate

Before successful payment:

- Lead remains a Lead
- No Booking operational processing
- No embassy submission
- No airline application
- No OTB processing
- No ticket issuance
- No service completion actions

After payment:

> **Lead → Booking**

Same ID retained.

---

# 8. COUPONS IN LEADS

Coupon application is available at Lead/payment stage.

Current employee coupon:

> **Maximum ₹500**

This is a current Admin configuration, not a permanent hard-coded business rule.

CRM must consume the current Admin-configured coupon limit.

Support:

- Employee coupon
- External coupon where configured
- Abandoned quotation coupon
- Service/sub-service eligibility
- Validity
- Used/expired status

Coupon discount must remain a separate invoice line.

---

# 9. QUOTATIONS

Quotation creation is service-specific.

## Visa Change quotation

Must support:

- Multiple quotation/package options
- A2A
- Border
- Airline selection
- Flight selection
- Airport selection
- Package
- Vendor
- Price

Selected package must flow into Booking.

## Visa Extension quotation

Must support:

- Normal processing only
- Extension amount
- Fine amount
- Additional amount
- Coupon
- Final payable amount

No Express extension.

## Flight quotation

Must support multiple options.

Each option may contain:

- Airline
- Flight
- Departure airport
- Arrival airport
- Date/time
- Fare type
- Refundable/non-refundable
- Baggage
- Vendor
- Selling amount

Selected quotation becomes Booking data.

---

# 10. PRICING

CRM calculates from Admin-configured values.

## Visa / Visa Change / Visa Extension / OTB

Conceptual calculation:

`Configured Service Amount`
`+ Additional Amount`
`+ Fine where applicable`
`- Coupon`
`+ Configured Gateway Charge`
`= Customer Payable`

## Flight

Staff can enter configured selling amount directly.

`Selling Amount + Configured Gateway Charge = Customer Payable`

Do not hard-code gateway or refund percentages.

Gateway/refund charges are Admin-configured.

---

# 11. BOOKINGS

Booking exists after successful payment/conversion.

## Booking list

Use a clean, professional, operational table.

Recommended columns:

- Booking ID
- Customer
- Service
- Sub-service
- PAX
- Booking Date
- Service/Travel Date
- Processing Type
- Status
- Payment
- Assigned staff/read-only assignment
- Action

Right side:

> **View / Action**

Do not copy the reference design exactly.

## Booking details

Opening a booking should show a professional detailed workspace.

Recommended structure:

### Booking header
- Booking ID
- Customer
- Service
- Sub-service
- Processing Type
- Booking Date
- Service/Travel Date
- Current status
- Customer-safe status

### Customer summary
- Customer details
- Contact
- Customer history shortcut

### Passenger/PAX area
Each PAX must be independently visible.

Example:

**Passenger 1**
- Name
- Individual service status where applicable
- Documents
- Upload
- Validation state
- Actions

**Passenger 2**
- Same structure

Do not force all PAX into one combined status where individual processing is required.

---

# 12. BOOKING DATES

Avoid ambiguous generic "Date" labels.

## Visa

Show separately:

- Booking Date
- Applied to Embassy Date
- Travel/Required Date

## Visa Change

Show:

- Booking Date
- Travel/Required Date
- Visa Number
- Visa Last Date / Expiry

## Visa Extension

Show:

- Booking Date
- Current Visa Last Date / Expiry
- Extension Required Date

## Flight

Show:

- Booking Date
- Travel Date

## OTB

Show:

- Booking Date
- Travel Date

## Return Verified Ticket

Show:

- Booking Date
- Return Travel Date

---

# 13. PROCESSING TYPE

Processing Type is separate from Hold.

## Visa

Configured values may include:

- Normal
- Express

Where Admin controls the rule, staff sees the value but cannot edit it.

## OTB

Configured values:

- Normal
- Urgent

OTB must not use Express.

## Hold

Hold is a CRM operational status/action, not Processing Type.

---

# 14. SERVICE-SPECIFIC STATUS ENGINE

Every service has its own status workflow.

CRM must never use one universal status list for all services.

The Change Status modal reads the configured status list for the booking's Service/Sub-service.

Examples where applicable:

- Hold
- Documents Pending
- Documents Validated
- Ready for Submission
- Applied to Embassy
- Applied to Airline
- OTB Pending
- OTB Approved
- OTB Rejected
- OTB Partially Approved
- Partial Approved
- Refund Raised
- Partial Refund
- Partial Cancellation
- Cancelled
- Completed

Only statuses configured by Admin for the selected service are available.

## Customer-safe status

Internal CRM status and customer-facing status remain separate.

Example:

Internal:

`Applied to Embassy`

Customer:

`Application submitted for processing.`

---

# 15. OTB ↔ RETURN VERIFIED TICKET

When customer purchases OTB + Return Verified Ticket together:

- Both remain separate service records
- Both are automatically linked
- No normal manual search/link is required
- OTB processing is first
- Return Ticket issuance is blocked until OTB is approved
- Each service keeps its own status list
- Staff can open each linked record from the other
- Cross-timeline events are recorded
- Customer-facing updates remain safe and accurate

## Link creation

The relationship is created automatically as part of the same Lead/Booking journey.

The existing prototype seed relationship must remain compatible.

## Return Ticket

Must not be issued before configured OTB approval.

---

# 16. DOCUMENTS

Documents are managed inside Lead/Booking.

## Upload flow

`Upload → Compression → OCR/Validation Result → Staff Action`

Staff actions:

- Approve / Validate
- Reject
- Request additional documents

Reject requires a mandatory reason.

## PAX-level documents

Each PAX has separate documents.

Example:

`Passenger Name → Documents dropdown → Upload / View / Validate`

## Customer uploads

Customers can upload additional documents through:

- Customer portal
- Customer upload link

## Staff uploads

Staff can upload customer documents for all PAX.

## Document states

- Pending
- Uploaded
- Validated
- Rejected
- Additional Documents Required

When required documents are validated, the configured workflow may automatically move the service status and trigger notification.

---

# 17. TICKET OCR / EXTRACTION

When a ticket is uploaded, CRM should extract available:

- Airline
- Flight Number
- PNR
- Passenger
- Departure Airport
- Arrival Airport
- Departure Date
- Departure Time
- Arrival Date
- Arrival Time
- Ticket Number
- Baggage

Show:

> **System Extracted Data**

Actions:

- Confirm
- Edit

Do not silently overwrite confirmed information.

After confirmation, ticket data is stored against the booking.

---

# 18. VISA OCR / EXTRACTION

When a visa PDF is uploaded, CRM should extract available:

- Passenger
- Passport Number
- Visa Number
- Visa Type
- Issue Date
- Expiry Date
- Validity

Staff confirms/edits extracted information.

When Visa is approved, provide the Visa PDF upload/confirmation workflow.

Visa approval/rejection:

- Approved → visa upload/confirmation
- Rejected → mandatory rejection reason

---

# 19. PAYMENT

Payment link generation is available from Lead.

Payment success:

1. Record payment
2. Convert Lead to Booking where applicable
3. Retain Lead ID as Booking ID
4. Trigger operational workflow
5. Trigger applicable notification
6. Generate invoice
7. Mark applicable coupon as Used
8. Add timeline event

Payment amount must use Admin-configured pricing/charges.

---

# 20. INVOICE

Current invoice state:

- No GST
- Simple professional invoice
- Automatically generated after successful payment
- Stored against Lead/Booking
- Customer visibility optional

Customer does not have to see it automatically.

Staff can share/send when required.

Invoice separates:

- Service amount
- Service charge
- Coupon discount
- Gateway/payment charge where applicable
- Grand total

Future GST is Admin-controlled and must not appear until enabled/configured.

---

# 21. REFUNDS

CRM staff can raise:

- Full refund
- Passenger-level partial refund

Refund requires:

- Reason
- Original amount
- Applicable configured charges
- Eligible refund
- Requested refund
- Passenger selection where partial passenger refund applies

## Passenger-level partial refund

For multi-PAX:

- Select individual passenger(s)
- Show selected passenger names
- Calculate eligible refund based on configured passenger allocation/charges
- Raise refund

Staff must not manually calculate the final eligible refund.

## Generic non-passenger partial refund

Keep as:

> **OPEN QUESTION**

Do not invent a calculation formula.

## Approval

CRM:

> Raise Refund

Admin:

> Approve / Reject

CRM cannot approve its own refund.

---

# 22. HOLD

Hold is part of the CRM/service status workflow.

Do not create a separate global Hold system that conflicts with service-specific statuses.

Hold must be represented according to the selected service's configured status/workflow.

---

# 23. CUSTOMERS

Customer profile should show complete operational history:

- Customer details
- Leads
- Bookings
- PAX
- Quotations
- Payments
- Refunds
- Documents
- Communications
- Timeline

Customer history should allow staff to move from customer → lead → booking.

---

# 24. VENDORS

CRM staff can:

- View vendors
- Compare vendors
- See services offered
- See countries
- See configured rates/costs where staff permission allows internal operational viewing
- See processing time
- See availability
- See validity
- Select vendor

Staff cannot edit vendor rates.

Vendor cost must never be exposed to customers.

Admin is the source of truth for vendor configuration/rates.

Vendor comparison may consider:

- Eligibility
- Availability
- Suitability
- Price
- Processing time
- Performance

The exact recommendation/scoring formula remains Admin-configurable.

---

# 25. COMMUNICATION

CRM communication includes:

- WhatsApp
- Email
- Notifications

AI-assisted drafting is allowed where enabled.

## AI drafting

Draft types may include:

- Status Update
- Document Request
- Payment Reminder
- Quotation Message
- Follow-up
- Refund Update
- Cancellation Message
- Visa Update
- Ticket Update
- Additional Information Request

AI drafts must:

- Use record data
- Avoid inventing missing information
- Clearly flag unavailable information
- Remain editable
- Never auto-send without staff action

## Timeline

Manual and AI-assisted sent communication should be logged in the relevant timeline.

---

# 26. NOTIFICATIONS

CRM must support notifications for important events.

Examples:

- New Lead
- New Booking
- Client accepted quotation
- Payment received
- Customer documents uploaded
- Document rejected
- Document validated
- Visa approved
- Visa rejected
- Ticket uploaded
- Ticket issued
- Refund raised
- Customer response required
- Staff action required
- Follow-up
- Delay
- Coupon generated
- Coupon used

Admin controls notification rules/templates.

CRM executes operational notifications.

---

# 27. KNOWLEDGE BASE / FAQ

CRM staff can search/read Admin-managed knowledge.

Categories:

- Country
- Service
- Sub-service
- Documents
- Visa
- OTB
- Ticket
- Refund
- Customer communication
- Operational procedures

CRM must not edit Admin-controlled knowledge unless explicit Admin permissions/configuration allow it.

---

# 28. HELP / NEED HELP

Help area can include:

- Search Knowledge Base
- FAQ
- How-to guides
- Contact Admin
- Report issue
- CRM usage guidance

Keep it simple and operational.

---

# 29. REPORTS

Reports are operational/business reports for CRM staff.

## KPI examples

- Total Bookings
- Total Leads
- Qualified Leads
- Conversion Rate
- Payment Received
- Payment Pending
- Completed
- Cancelled
- Refunds
- On Hold
- Delayed

## Booking Analytics

Break down by:

- Service
- Sub-service
- Status

## Lead Conversion

Show:

- Leads
- Qualified
- Converted
- Conversion rate

## Financial Reporting

Separate:

### Customer-facing/operational
- Sales
- Payments
- Refunds
- Coupons

### Internal-only
- Vendor cost
- Margin
- Loss

Internal financial information must never be shown to customers.

## Refund Report

Show:

- Refund ID
- Booking
- Customer
- PAX
- Original
- Charges
- Eligible
- Requested
- Approved
- Status
- Reason

## Staff Workload

Show operational workload without exposing sensitive internal information to customers.

## Service Mix

Show:

- Service
- Volume
- Percentage share

---

# 30. DELAY ANALYSIS

Delay Analysis should show:

- Total delays
- Open delays
- Resolved delays
- Average duration
- Longest open

Breakdowns:

- Service
- Sub-service
- Reason
- Staff
- Vendor
- Category

Table:

- Booking
- Customer
- Service Date
- Started
- Duration
- Reason
- Category
- Staff
- Vendor
- Status

Clicking a row opens the booking.

---

# 31. PROFILE & SECURITY

CRM Profile includes:

- Staff profile
- Change Password
- Security Question
- Logout

## Change Password

Required:

- Current password
- New password
- Confirm password

If password reset is required by Admin:

- Admin can trigger/reset according to the separate authentication system.

Security questions must be required/configured when applicable.

Do not present this as an Admin configuration screen.

---

# 32. DARK/LIGHT MODE

Do not include a dark/light theme control in the CRM Command Centre.

Final Figma should use one approved visual theme.

Avoid continuing the prototype's unfinished dark-mode implementation.

Preferred design direction:

- Simple
- Clean
- Professional
- Modern
- Glassy elements where useful
- Operationally dense without clutter
- Do not copy reference designs 1:1

---

# 33. SOUND

If sound notifications are retained, use a simple sound control according to the final approved Figma.

Do not use a notification bell as the primary notification control.

---

# 34. ASSIGNMENT RULE

Normal CRM staff cannot:

- Assign another staff member
- Reassign a booking
- Change roster
- Override Admin assignment rules

Admin can:

- Assign
- Reassign
- Bulk reassign
- Manage leave
- Confirm replacement
- Override assignment

CRM should display assignment information as appropriate but not expose Admin controls.

---

# 35. WEBSITE ↔ CRM ↔ ADMIN

## Website → CRM

- Enquiry → Lead
- Service request → Lead
- Customer document upload → Lead/Booking
- Quotation acceptance → Staff Action Required
- Payment → Booking conversion
- Customer response → Communication
- Refund request → CRM refund workflow

## Admin → CRM

Admin configuration drives:

- Countries
- Services
- Sub-services
- Pricing
- Statuses
- Vendors
- Documents
- Processing types
- Roster
- Assignment
- Coupons
- Payment rules
- Notifications
- Knowledge Base

## CRM → Website

Customer-safe information:

- Booking status
- Document requests
- Payment status
- Quotation status
- Ticket/visa updates
- Refund status
- Notifications
- Invoice when customer visibility is enabled/requested

Never expose:

- Vendor cost
- Internal margin
- Staff workload
- Internal notes
- Internal assignment
- Admin-only configuration

---

# 36. TIMELINE

Every important operational action should be recorded.

Examples:

- Lead created
- Lead edited
- Quotation created
- Quotation accepted
- Payment link generated
- Payment received
- Lead converted to Booking
- Staff document uploaded
- Customer document uploaded
- Document validated
- Document rejected
- Status changed
- Vendor selected
- Refund raised
- Refund updated
- Communication sent
- Ticket data confirmed
- Visa data confirmed
- OTB/Return Ticket linked
- OTB approved
- Return Ticket issued
- Coupon generated
- Coupon applied
- Coupon used
- Invoice generated

Timeline should preserve old/new status where relevant.

---

# 37. SERVICE-SPECIFIC OPERATIONAL SUMMARY

## New Visa

Typical flow:

`Lead → Quotation/Pricing → Payment → Booking → Documents → Validated → Ready for Submission → Applied to Embassy → Visa Approved/Rejected → Visa Upload/Confirmation → Completed`

Processing type:

`Normal / Express`

## Visa Change

Typical flow:

`Lead → A2A/Border Quotation → Customer Selection → Payment → Booking → Documents → Visa Change Processing → Completed`

Preserve A2A/Border data.

## Visa Extension

Typical flow:

`Lead → Extension Quotation → Fine/Additional Amount → Payment → Booking → Documents → Processing → Completed`

Processing:

`Normal only`

## OTB

Typical flow:

`Lead → Payment → Booking → Airline Processing → OTB Pending → OTB Approved/Rejected/Partially Approved → Completed`

Processing:

`Normal / Urgent`

## Return Verified Ticket

Typical flow:

`Lead → Payment → Booking → Waiting for OTB approval when linked → Ticket Processing → Ticket Issued → Completed`

When linked with OTB, Return Ticket remains a separate service record.

## Flight / Special Fare

Typical flow:

`Lead → Multiple Quotations → Customer Selects → Payment → Booking → Ticket Processing → Ticket Issued → Completed`

---

# 38. DATA OWNERSHIP

| Data / Function | Source of Truth |
|---|---|
| Staff account | Admin |
| Staff permissions | Admin |
| Roster | Admin |
| Assignment rules | Admin |
| Countries | Admin |
| Services | Admin |
| Sub-services | Admin |
| Status configuration | Admin |
| Pricing configuration | Admin |
| Vendor rates | Admin |
| Document checklist | Admin |
| Coupon configuration | Admin |
| Gateway configuration | Admin |
| Lead operational record | CRM |
| Booking operational record | CRM |
| Customer communication execution | CRM |
| Customer documents | CRM/Website |
| Refund request | CRM |
| Refund approval | Admin |
| Customer-safe status execution | CRM |
| Customer portal presentation | Website |
| Admin audit | Admin |
| Operational timeline | CRM |

---

# 39. IMPORTANT BUSINESS RULES

1. Payment is the gate from Lead to Booking.
2. Lead ID becomes Booking ID after successful payment.
3. Staff cannot assign/reassign.
4. Admin controls assignment and roster.
5. Every service has its own status list.
6. Processing Type is separate from Hold.
7. Visa can use Normal/Express where configured.
8. OTB uses Normal/Urgent, not Express.
9. Visa Extension is Normal only.
10. Passenger-level partial refunds require passenger selection.
11. CRM raises refunds; Admin approves/rejects.
12. Generic non-passenger partial refund formula remains open unless configured.
13. Gateway/refund charges are configurable; do not hard-code 2%.
14. Coupon discount remains separate from service amount.
15. Current employee coupon maximum is ₹500, controlled by Admin configuration.
16. Invoice currently has no GST.
17. Invoice is generated after successful payment.
18. Customer invoice visibility is optional.
19. GST is future/Admin-controlled.
20. Vendor rates are Admin-controlled.
21. Vendor cost is internal.
22. Required documents are configurable by Admin.
23. Documents are handled per passenger where applicable.
24. Document rejection requires a reason.
25. OCR data must be confirmed before becoming authoritative.
26. OTB + Return Ticket are separate linked service records.
27. OTB processing comes first.
28. Return Ticket issuance is blocked until required OTB approval.
29. Customer-facing status must remain safe and understandable.
30. CRM must consume Admin configuration rather than duplicate it.

---

# 40. CRM Figma DESIGN DIRECTION

The final CRM Figma should be:

- Simple
- Clean
- Professional
- Modern
- Easy to scan
- Operationally dense without clutter
- Glassy where it improves hierarchy
- Consistent across List, Details, Command Centre and Reports

Do not copy reference screens 1:1.

## Booking List

Professional table with:

- Filters
- Search
- Status/service indicators
- PAX
- Dates
- Payment
- Processing Type
- Right-side View/Action

## Booking Details

Professional workspace with:

- Header
- Summary
- PAX cards
- Individual status
- Individual documents
- Pricing/payment
- Vendor
- Timeline
- Communication
- Actions

## Command Centre

Short page:

- Welcome
- Sales Overview
- Operations Overview
- Most Action Required
- Charts
- Calendar filter

Avoid unnecessary long sections.

---

# 41. CURRENT OPEN QUESTIONS

These should not be invented during Figma.

## O1 — Generic partial refund
No approved formula.

## O2 — Assignment workload weighting
Exact PAX/service/capacity weighting remains configurable/Admin-controlled.

## O3 — Customer-safe status mapping
Final mappings should be Admin-configurable.

## O4 — GST
Current state OFF. Future tax/SAC rules not yet defined.

## O5 — Production integrations
Final providers and production setup remain to be selected for:

- WhatsApp
- Email
- Payment gateway
- OCR
- Airline APIs
- Vendor APIs
- Background jobs

---

# 42. FINAL CRM ↔ ADMIN COMPATIBILITY

CRM and Admin are designed to work together.

### Admin
**Controls / Configures / Governs**

### CRM
**Operates / Processes / Communicates**

### Website
**Acquires / Serves / Updates Customer**

No major structural conflict is intended.

The critical boundary is:

> **Do not duplicate Admin configuration inside CRM.**

CRM should consume Admin-controlled configuration through shared APIs/services.

---

# 43. PRE-FIGMA CRM CHECKLIST

- [ ] Lead flow approved
- [ ] Booking flow approved
- [ ] Service-specific forms approved
- [ ] Service-specific statuses approved
- [ ] PAX-level workflow approved
- [ ] Document workflow approved
- [ ] OCR workflow approved
- [ ] Quotation builders approved
- [ ] Pricing behavior approved
- [ ] Payment behavior approved
- [ ] Coupon behavior approved
- [ ] Refund behavior approved
- [ ] Invoice behavior approved
- [ ] Customer section approved
- [ ] Vendor section approved
- [ ] Command Centre approved
- [ ] Reports approved
- [ ] Delay Analysis approved
- [ ] Communication approved
- [ ] Knowledge Base approved
- [ ] Help approved
- [ ] Profile/security approved
- [ ] Staff/Admin boundary approved
- [ ] Website ↔ CRM ↔ Admin flow approved
- [ ] Open questions explicitly marked

---

# 44. NEXT STEP

This CRM document should be reviewed together with:

**TripNexio Admin Functional Master Document v1.0**

Then:

1. Freeze CRM + Admin requirements.
2. Finalize Figma Design System.
3. Design CRM Figma.
4. Design Admin Figma.
5. Design Website Figma.
6. Review complete clickable prototype.
7. Create technical architecture.
8. Begin production development.

**Do not use the prototype HTML as the final source of truth.**

The approved functional documents + approved Figma should become the source of truth for production implementation.
