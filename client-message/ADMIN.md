# TRIPNEXIO ADMIN --- FUNCTIONAL MASTER DOCUMENT

**Version:** 1.0\
**Status:** Admin Architecture Review Draft\
**Purpose:** Define the TripNexio Admin application so it can be
compared directly against the current CRM requirements before
Figma/design or development.

------------------------------------------------------------------------

# 1. PLATFORM MODEL

TripNexio consists of three connected applications:

1.  **Website / Customer Portal** --- customer-facing acquisition,
    quotations, payment, documents and updates.
2.  **CRM** --- staff operational workspace.
3.  **Admin** --- configuration, permissions, roster, pricing, vendors
    and governance.

## Core principle

> **Admin controls/configures. CRM operates. Website serves the
> customer.**

Admin and CRM are separate applications with separate
access/authentication while communicating through shared APIs/platform
services and a shared business/data model.

------------------------------------------------------------------------

# 2. ADMIN PURPOSE

Admin is the platform-control layer.

Admin should allow authorized administrators to configure, control,
monitor and govern TripNexio without requiring code for normal business
configuration.

Admin should eventually cover:

-   Staff
-   Roles
-   Permissions
-   Roster
-   Assignment
-   Countries
-   Services
-   Sub-services
-   Workflows
-   Statuses
-   Processing Types
-   Pricing
-   Vendors
-   Vendor Rates
-   Documents
-   Quotations
-   Payments
-   Coupons
-   Refunds
-   Notifications
-   WhatsApp
-   Email
-   Knowledge Base
-   FAQ
-   Financial controls
-   Reports
-   Expenses
-   Audit
-   System settings
-   Integrations
-   Automation
-   AI Command Center
-   Live platform monitoring

------------------------------------------------------------------------

# 3. ADMIN VS CRM

## Admin

Admin controls/configures:

-   Staff accounts
-   Roles and permissions
-   Roster and leave
-   Automatic assignment
-   Assignment rules
-   Countries
-   Services
-   Sub-services
-   Service workflows
-   Service-specific statuses
-   Processing types
-   Pricing
-   Vendor rates
-   Vendors
-   Document checklists
-   Quotation configuration
-   Payment/gateway rules
-   Coupons
-   Refund configuration
-   Customer notification rules
-   WhatsApp/Email configuration
-   Knowledge Base / FAQ
-   Financial controls
-   Reports
-   Audit logs
-   System settings
-   Integrations
-   Automation
-   AI/platform controls

## CRM

CRM operates:

-   Leads
-   Customers
-   Quotations
-   Bookings
-   Documents
-   Payments
-   Refund requests
-   Customer communication
-   Operational processing
-   Knowledge Base usage
-   Operational reporting

## Boundary

> **Do not duplicate Admin configuration controls inside CRM.**

CRM consumes Admin configuration and performs day-to-day operations.

------------------------------------------------------------------------

# 4. INITIAL ADMIN ACCESS

## Initial state

There is initially:

> **1 Super Admin**

Super Admin has full Admin access.

Later, Super Admin can:

-   Create Admin users
-   Enable/disable Admin users
-   Select permissions for each Admin
-   Modify permissions
-   Remove/disable Admin access

Predefined Admin roles are not required initially.

Custom permission assignment should be supported.

------------------------------------------------------------------------

# 5. ADMIN AUTHENTICATION

Admin has:

-   Separate login
-   Separate authentication
-   Separate Admin permissions
-   Separate Admin access control
-   Password/security controls
-   Audit logging

CRM staff authentication and permissions must not automatically grant
Admin access.

## OTP

Email OTP for Admin actions is **removed for now**.

Current sensitive-action flow:

> Permission check → confirmation where appropriate → execute → audit
> log.

OTP/2FA may be added later.

------------------------------------------------------------------------

# 6. ADMIN NAVIGATION

## 01 --- Command Center

-   Admin Dashboard
-   Live Activity
-   System Health
-   Alerts / Exceptions
-   AI Admin Assistant

## 02 --- Organization

-   Staff
-   Roles
-   Permissions
-   Staff Roster
-   Leave Management
-   Assignment Rules
-   Capacity / Workload
-   Staff Activity

## 03 --- Services & Master Data

-   Countries
-   Services
-   Sub-services
-   Processing Types
-   Service Statuses
-   Service Workflows
-   Master Data

## 04 --- Pricing & Vendors

-   Pricing
-   Vendor Rates
-   Vendors
-   Pricing History
-   Vendor Rate History
-   Vendor Performance
-   Vendor Recommendation

## 05 --- Operations Configuration

-   Document Checklists
-   Quotation Configuration
-   SLA / TAT
-   Assignment Configuration

## 06 --- Payments & Commercial

-   Payment Gateways
-   Payment Methods
-   Gateway Fees
-   Payment Configuration
-   Coupons
-   Refund Configuration
-   Refund Approval

## 07 --- Communications & Knowledge

-   WhatsApp
-   Email
-   Notification Rules
-   Message Templates
-   Knowledge Base
-   FAQs
-   Service Guides
-   Country Guides
-   Document Instructions
-   Operational Procedures

## 08 --- Reporting & Finance

-   Executive Reports
-   Sales
-   Revenue
-   Vendor Cost
-   Profit
-   Margin
-   Refunds
-   Gateway Charges
-   Coupons
-   Expenses
-   P&L
-   Service Analytics
-   Country Analytics
-   Vendor Analytics
-   Staff Workload
-   Export Center

## 09 --- Platform & Integrations

-   CRM Settings
-   Automation
-   Automation Monitor
-   API / Integrations
-   Provider Configuration
-   Integration Health
-   OCR
-   OCR Monitor
-   AI Configuration
-   Tool Health
-   n8n

## 10 --- Security & Governance

-   Admin Users
-   Admin Permissions
-   Audit Logs
-   Configuration History
-   Security Settings
-   Access History

------------------------------------------------------------------------

# 7. ADMIN DASHBOARD

Admin Dashboard is a platform command center, not a duplicate of the CRM
operational dashboard.

## Business overview

-   Leads
-   Bookings
-   Revenue
-   Profit
-   Margin
-   Refunds
-   Expenses

## Operations overview

-   Active bookings
-   Pending work
-   Staff workload
-   Roster status
-   Assignment health
-   Service performance
-   Country performance
-   Vendor performance

## Approvals

-   Pending refunds
-   Other future Admin-controlled approvals

## Platform health

-   Payment gateway
-   WhatsApp
-   Email
-   OCR
-   AI
-   n8n
-   APIs
-   Website
-   CRM connectivity

## Live activity

-   Website visitors
-   New inquiries
-   Active WhatsApp conversations
-   New bookings
-   Payments
-   Document/OCR activity
-   Staff activity

## AI

Prominent:

> **Ask TripNexio AI**

------------------------------------------------------------------------

# 8. GLOBAL ADMIN DATA ACCESS

Admin should have broad internal visibility across TripNexio.

Authorized Admin users can access/search:

-   All bookings
-   All leads
-   All customers
-   All PAX
-   Documents
-   OCR data
-   Quotations
-   Payments
-   Refunds
-   TAT records
-   SLA records
-   Staff activity
-   Assignment history
-   Vendor activity
-   Service activity
-   Communication history
-   WhatsApp activity
-   Email activity
-   Automation records
-   API/integration logs
-   Audit logs
-   Pricing history
-   Status history
-   Workflow history
-   Other platform data permitted by Admin permissions

This is Admin visibility/control and does not mean rebuilding the CRM UI
inside Admin.

------------------------------------------------------------------------

# 9. GLOBAL ADMIN SEARCH

Admin should have a global search/command experience.

Examples:

-   Search Booking ID
-   Search Lead ID
-   Search customer
-   Search PAX
-   Search service
-   Search vendor
-   Search refund
-   Search escalation/SLA information where applicable
-   Search audit activity
-   Search automation
-   Search integration failures

Admin should be able to ask:

> "Show me everything about this booking."

The system should connect booking, customer, PAX, payment, documents,
OCR, staff, vendor, status, TAT and timeline information where
available.

------------------------------------------------------------------------

# 10. AI COMMAND CENTER

AI is a core Admin capability.

It should operate as a natural-language command assistant.

Examples:

-   "Show me today's P&L."
-   "Show all pending refunds."
-   "Why is this booking stuck?"
-   "Show me today's failed automations."
-   "Check WhatsApp."
-   "Check n8n."
-   "Check OCR."
-   "Check Meta tracking."
-   "Check Google tracking."
-   "Show staff workload."
-   "Show website visitors."
-   "Why are customers not purchasing this service?"
-   "Show me today's price changes."
-   "Create a FAQ."
-   "Create a WhatsApp template."
-   "Increase this service price."
-   "Disable this service."
-   "Show me all bookings handled by this POC."

## AI execution model

> Understand → Permission Check → Validate → Determine Risk → Confirm if
> needed → Execute → Audit

AI should distinguish:

-   Facts observed in data
-   System diagnosis
-   Possible explanations
-   Recommendations

It must not invent a reason when the data does not establish one.

------------------------------------------------------------------------

# 11. LIVE PLATFORM MONITORING

Admin should be able to see live platform activity.

## Website

-   Live visitors
-   Service/page activity
-   New inquiries
-   Active quotation activity
-   Payment/checkout activity

## WhatsApp

-   Active conversations
-   New inquiries
-   Waiting conversations
-   Payment discussions
-   Document discussions
-   Other configured conversation states

## Platform

-   New bookings
-   Payments
-   Documents
-   OCR processing
-   Staff activity
-   Automation activity

AI should be able to investigate live/available data and explain
possible conversion problems.

Example:

> "Why are visitors viewing Visa but not purchasing?"

AI can analyze the configured journey:

> Visitor → Service → Inquiry → Quotation → Payment → Booking

and identify observed drop-off points.

------------------------------------------------------------------------

# 12. STAFF MANAGEMENT

Admin controls:

-   Staff accounts
-   Active/inactive state
-   Roles/permissions
-   Services handled
-   Countries handled
-   Roster
-   Leave
-   Capacity
-   Workload
-   Assignment eligibility

CRM staff cannot:

-   Assign/reassign bookings
-   Manage roster
-   Change vendor rates
-   Change global pricing
-   Add countries/services
-   Change global status configuration
-   Approve refunds
-   Change Admin configuration

------------------------------------------------------------------------

# 13. ROSTER & ASSIGNMENT

Admin can enable/disable:

-   Roster System
-   Automatic Assignment

## Assignment factors

Assignment can consider:

-   Service
-   Country
-   Sub-service
-   Staff capability
-   Availability
-   Current workload
-   Adult count
-   Child count
-   PAX workload

## Locked workload principle

> **Workload is based on number of PAX.**

Example:

Staff 1: - 2 bookings - 4 PAX

Staff 2: - 1 booking - 8 PAX

A new eligible booking should prefer Staff 1, assuming both are
available and eligible.

No complex weighting formula is required at this stage.

## Manual Admin reassignment

Admin can manually assign/reassign.

CRM staff cannot.

Manual reassignment should record a reason.

## Bulk reassignment

Admin can select a POC/staff and move their open eligible work in one
action.

Example:

> Staff A → Open Bookings → Select All → Reassign → Staff B

Affected Leads/Bookings should be auditable.

## Staff leave

1.  Staff becomes unavailable.
2.  Affected open work is identified.
3.  Replacement staff can be recommended.
4.  Admin confirms reassignment.
5.  Audit records the change and reason.

------------------------------------------------------------------------

# 14. COUNTRY ARCHITECTURE

Country architecture must be dynamic.

Recommended hierarchy:

> **Country → Service → Sub-service → Workflow → Status → Documents →
> Pricing → Vendors**

Admin can add future countries without redesigning the CRM core.

Each country can have configuration for:

-   Services
-   Sub-services
-   Workflows
-   Statuses
-   Documents
-   Pricing
-   Vendors
-   Processing rules
-   Quotation rules
-   Customer communication

------------------------------------------------------------------------

# 15. SERVICE ARCHITECTURE

Current services:

-   New Visa
-   Visa Change
-   Visa Extension
-   Ok to Board
-   Return Verified Ticket
-   Flight / Special Fare

This list can expand.

Admin can:

-   Add service
-   Edit service
-   Enable/disable service
-   Configure sub-services
-   Configure country availability
-   Configure statuses
-   Configure workflows
-   Configure pricing
-   Configure documents
-   Configure vendors
-   Configure quotation rules
-   Configure customer communication
-   Configure processing types

A completely new service should be architecturally configurable without
changing the CRM core, provided all required configuration is completed.

------------------------------------------------------------------------

# 16. SERVICE-SPECIFIC STATUS

There is no universal operational status list.

Every service has its own applicable statuses.

Examples where applicable:

-   Hold
-   Documents Pending
-   Documents Validated
-   Ready for Submission
-   Applied to Embassy
-   Applied to Airline
-   OTB Pending
-   OTB Approved
-   OTB Rejected
-   OTB Partially Approved
-   Partial Approved
-   Refund Raised
-   Partial Refund
-   Partial Cancellation
-   Cancelled
-   Completed

Only statuses applicable to the selected service/sub-service should be
enabled.

CRM operational status and customer-safe status remain separate.

------------------------------------------------------------------------

# 17. SERVICE WORKFLOW

Admin configures:

-   Available statuses
-   Status transitions
-   Workflow order
-   Applicable service/sub-service
-   Conditions where defined
-   Notification triggers
-   SLA/TAT behavior where configured

Workflow configuration must remain service-specific.

------------------------------------------------------------------------

# 18. PROCESSING TYPES

Admin controls permitted processing types.

Examples:

### Visa

-   Normal
-   Express

### OTB

-   Normal
-   Urgent

### Visa Extension

-   Normal

Processing types are configurable.

Staff sees the configured value and cannot edit it where
Admin-controlled.

------------------------------------------------------------------------

# 19. PRICING

Admin configures pricing.

Pricing can depend on:

-   Country
-   Service
-   Sub-service
-   Processing type
-   Adult price
-   Child price
-   Additional amount
-   Fine
-   Vendor cost
-   Selling price
-   Effective date
-   Validity
-   Active/inactive

## Pricing calculation

For applicable services:

> Configured Service Amount + Additional Amount + Fine where
> applicable - Coupon + Gateway Charge = Customer Payable

For Flight:

> Staff Selling Amount + Configured Gateway Charge = Customer Payable

Do not hard-code gateway/refund percentages.

## Immediate activation

Admin price changes become immediately active.

## Paid booking protection

If a booking has been made and payment is completed:

> **Later Admin configuration changes do not affect that paid booking.**

Therefore paid bookings retain their committed pricing/configuration
snapshot.

Unpaid work can follow the current active configuration according to the
applicable rules.

------------------------------------------------------------------------

# 20. VENDOR MANAGEMENT

Admin manages:

-   Vendor profile
-   Countries
-   Services
-   Sub-services
-   Vendor rates
-   Cost
-   Processing time
-   Validity
-   Availability
-   Documents
-   Contacts
-   Status
-   Performance

Vendor cost remains internal.

Customers see selling price, not vendor cost.

CRM staff can view/compare/select configured vendors but cannot modify
vendor rates.

------------------------------------------------------------------------

# 21. VENDOR RECOMMENDATION ENGINE

Vendor recommendation is required and should be more advanced than
simply selecting the cheapest vendor.

Initial recommendation direction:

> **Service eligibility → Country/sub-service eligibility → Availability
> → Service suitability → Price → Processing time → Performance →
> Recommendation**

The system should generate a recommendation among eligible configured
vendors.

Admin should eventually be able to configure recommendation priorities.

Future rules may consider:

-   Price
-   Processing time
-   Vendor performance
-   Availability
-   Service suitability
-   Country capability
-   Validity
-   Other approved operational factors

Do not hard-code the final scoring formula before it is approved.

------------------------------------------------------------------------

# 22. DOCUMENT CHECKLIST

Admin configures checklists by:

-   Country
-   Service
-   Sub-service
-   Visa type where applicable
-   Passenger type where applicable

Admin can:

-   Add document
-   Remove document
-   Rename document
-   Required/optional
-   Reorder
-   Enable/disable
-   Configure conditions

CRM automatically uses the configured checklist.

## Existing paid bookings

If a booking has been made and payment completed:

> Later checklist configuration changes must not silently alter the
> committed booking requirements.

Exact handling of unpaid existing work should be finalized before
implementation.

------------------------------------------------------------------------

# 23. QUOTATION CONFIGURATION

Admin controls quotation rules for:

-   Visa
-   Visa Change
-   Visa Extension
-   OTB
-   Flight / Special Fare

## Visa Change

Supports:

-   A2A
-   Border

with configured package/quotation options.

## Flight

Supports multiple fare options.

Selected quotation/package flows into CRM Booking.

------------------------------------------------------------------------

# 24. PAYMENT / GATEWAY CONFIGURATION

Admin controls:

-   Gateway configuration
-   Payment methods
-   Gateway fee
-   Payment-link settings
-   Payment status rules
-   Refund/gateway charges

Gateway fees must be configurable.

Do not hard-code 2% or another percentage.

------------------------------------------------------------------------

# 25. COUPONS

Admin controls:

-   Coupon rules
-   Maximum employee coupon
-   Eligibility
-   Validity
-   Service/sub-service eligibility
-   External coupons
-   Abandoned quotation coupon rules
-   Expiration

## Current employee coupon limit

> **₹500**

This should be an Admin configuration value, not permanent hard-coded
logic.

Initially Super Admin controls it.

------------------------------------------------------------------------

# 26. REFUNDS

CRM/customer flow can raise refund requests according to the configured
journey.

Admin controls approval.

Current supported concepts:

-   Full refund
-   Passenger-level refund
-   Configured charges
-   Approval/rejection
-   Refund history

Do not invent generic non-passenger partial-refund formulas.

Do not hard-code gateway/refund charges.

------------------------------------------------------------------------

# 27. GST / INVOICE

## Current

> **GST OFF**

Current invoice is non-GST.

## Future

Admin can enable/configure GST when required.

Admin should be able to configure applicable financial components such
as:

-   GST
-   In-house service fee
-   Gateway fee
-   Other approved invoice components

Example:

> Service Amount + In-house Service Fee + Gateway Fee + GST = Customer
> Payable

Actual GST/SAC/tax rules are not yet defined and must not be invented.

------------------------------------------------------------------------

# 28. EXPENSE MANAGEMENT

Admin needs an expense system.

Expense categories should use Admin-managed dropdown options.

Initial examples:

-   Advertising
-   Salary
-   Domain
-   VPS / Hosting
-   AI
-   API
-   WhatsApp
-   Email
-   Software
-   OCR
-   Payment Gateway
-   Vendor
-   Office
-   Marketing
-   Operations
-   Other

Admin can later add/disable/reorder categories.

Expenses feed financial reporting and P&L.

------------------------------------------------------------------------

# 29. FINANCIAL REPORTING

Admin has higher-level internal financial visibility than CRM.

Reports can include:

-   Sales
-   Revenue
-   Vendor Cost
-   Profit
-   Margin
-   Loss
-   Refunds
-   Gateway Charges
-   Coupons
-   Expenses
-   P&L
-   Service performance
-   Country performance
-   Vendor performance
-   Staff workload

Internal vendor cost and margin must remain Admin-only.

------------------------------------------------------------------------

# 30. COMMUNICATION CONFIGURATION

Admin controls:

-   WhatsApp configuration
-   Email configuration
-   Notification rules
-   Message templates
-   Event triggers

Possible event triggers include:

-   Lead created
-   Payment link generated
-   Payment received
-   Document uploaded
-   Document rejected
-   Document validated
-   Quotation created
-   Quotation accepted
-   Booking created
-   Visa submitted
-   Visa approved
-   Visa rejected
-   Ticket issued
-   Refund raised
-   Refund approved/rejected
-   Hold
-   Delay
-   Coupon generated

CRM executes communication using Admin-configured rules.

------------------------------------------------------------------------

# 31. KNOWLEDGE BASE / FAQ

Admin creates/edits:

-   FAQs
-   Knowledge articles
-   Country guides
-   Service guides
-   Document instructions
-   Operational procedures

Articles can be categorized by:

-   Country
-   Service
-   Sub-service
-   Staff role

CRM staff can search/read the approved knowledge.

AI can use approved knowledge where configured.

------------------------------------------------------------------------

# 32. INTEGRATIONS / PRODUCTION PROVIDERS

Production providers are a required Admin capability.

Admin needs an integrations/provider area for:

-   WhatsApp
-   Email
-   OCR
-   Payment Gateway
-   Airline APIs
-   Vendor APIs
-   AI providers
-   Automation/background jobs
-   n8n
-   Meta
-   Google
-   Future integrations

For each integration:

> Provider → Configuration → Connection → Health → Usage → Errors → Logs
> → Test

Provider decisions are implementation/integration decisions and should
be confirmed before production connection.

------------------------------------------------------------------------

# 33. AUTOMATION / n8n

Admin should monitor automation infrastructure.

For each workflow:

-   Name
-   Purpose
-   Trigger
-   Status
-   Last execution
-   Last success
-   Last failure
-   Errors
-   Execution history
-   Health

Admin should be able to enable/disable/test/retry where safely
supported.

AI should diagnose automation failures.

------------------------------------------------------------------------

# 34. OCR

Admin should be able to monitor OCR:

-   Enabled/disabled
-   Processing
-   Success/failure
-   Failed jobs
-   Retry
-   Configuration
-   Logs
-   Processing time

OCR data remains accessible internally to authorized Admin users.

Staff must confirm/edit extracted data where the existing workflow
requires confirmation.

------------------------------------------------------------------------

# 35. META / GOOGLE TRACKING

Admin should eventually have a tracking/attribution control area.

It should support monitoring of configured:

-   Meta tracking
-   Meta lead events
-   Conversion events
-   Google Ads tracking
-   Google Analytics
-   Google Tag Manager
-   UTM attribution
-   Lead conversion
-   Application conversion
-   Payment conversion
-   Booking conversion

AI should be able to diagnose tracking problems and report what appears
broken.

------------------------------------------------------------------------

# 36. LIVE CUSTOMER ACTIVITY

Admin can see live/available platform activity such as:

-   Website visitors
-   Current service/page activity
-   New inquiries
-   Active quotations
-   Payment activity
-   WhatsApp conversations
-   New bookings
-   Document/OCR activity

AI can investigate conversion/drop-off patterns.

Example:

> "Why are customers visiting Visa but not purchasing?"

AI should analyze available data and distinguish observed evidence from
hypotheses.

------------------------------------------------------------------------

# 37. GLOBAL AUDIT LOG

Admin audit should record:

-   User
-   Date/time
-   Action
-   Old value
-   New value
-   Lead/Booking ID where applicable
-   Source
-   Reason where applicable

Examples:

-   Status changed
-   Price changed
-   Vendor changed
-   Checklist changed
-   Staff assignment changed
-   Refund approved
-   Coupon configuration changed
-   Service enabled/disabled
-   Workflow changed
-   Payment configuration changed

## Retention

> **1 year**

Audit logs should remain searchable/viewable for 12 months.

------------------------------------------------------------------------

# 38. ADMIN SECURITY

Admin should have:

-   Separate authentication
-   Admin users
-   Permission controls
-   Security settings
-   Access history
-   Audit logs
-   Sensitive-action confirmation where appropriate

OTP is not part of the current Admin flow.

------------------------------------------------------------------------

# 39. WEBSITE ↔ CRM ↔ ADMIN

## Website → CRM

-   Enquiry → Lead
-   Service request → Lead
-   Document upload → Lead/Booking
-   Quotation acceptance → Staff Action Required
-   Payment → Booking conversion
-   Customer response → CRM communication
-   Refund request → CRM

## Admin → CRM

Admin configuration drives:

-   Countries
-   Services
-   Pricing
-   Statuses
-   Vendors
-   Documents
-   Processing types
-   Roster
-   Assignment
-   Coupons
-   Payment rules
-   Notifications

## CRM → Website

Customer-safe:

-   Booking status
-   Document requests
-   Payment status
-   Quotation status
-   Ticket/visa updates
-   Refund status
-   Notifications

## Admin → Website

Appropriate customer-facing configuration:

-   Countries
-   Services
-   Packages
-   Customer-facing pricing where applicable
-   Document requirements
-   Offers
-   Notifications

Never expose:

-   Vendor cost
-   Internal margin
-   Staff workload
-   Internal notes
-   Internal assignment
-   Admin-only configuration

------------------------------------------------------------------------

# 40. CONFIGURATION CHANGE PRINCIPLE

The central rule is:

> **Admin configuration changes become immediately active.**

Exception:

> **Paid bookings retain their committed configuration.**

Therefore the platform needs configuration/version snapshots for
committed paid transactions.

Examples of protected paid-booking data:

-   Price
-   Applicable service configuration
-   Relevant document requirement/configuration
-   Other committed commercial/operational configuration as required

Exact behavior for unpaid existing work must be finalized before
implementation.

------------------------------------------------------------------------

# 41. AI ASSISTANT --- "SIRI FOR ADMIN"

The Admin AI should provide a natural-language command interface across
the platform.

Admin can ask:

-   "Show me today's P&L."
-   "Show all bookings for this customer."
-   "Why is this booking delayed?"
-   "Show TAT records."
-   "Show all pending refunds."
-   "Show staff workload."
-   "Why did this vendor get recommended?"
-   "Check n8n."
-   "Check OCR."
-   "Check WhatsApp."
-   "Check Meta."
-   "Check Google tracking."
-   "Why are customers abandoning this quotation?"
-   "Show me all service price changes."
-   "Add a new FAQ."
-   "Change this service price."
-   "Disable this service."
-   "Show me all failed tools."

AI can diagnose and assist with external integrations and platform
configuration.

For actions, the AI must use Admin permissions and audit execution.

------------------------------------------------------------------------

# 42. ADMIN DATA QUESTIONS

Admin should be able to ask the system about:

-   Any booking
-   Any lead
-   Any customer
-   Any PAX
-   Documents
-   OCR
-   Payments
-   Refunds
-   Quotations
-   TAT
-   SLA
-   Staff activity
-   Assignment
-   Vendors
-   Service activity
-   Communications
-   Automation
-   Integrations
-   Pricing
-   Audit

Example:

> "Give me everything about booking TNX123."

The system should summarize the connected information available to
Admin.

------------------------------------------------------------------------

# 43. ADMIN SCREEN INVENTORY

## Command Center

1.  Admin Dashboard
2.  Live Activity
3.  System Health
4.  Alerts
5.  AI Command

## Organization

6.  Staff
7.  Staff Details
8.  Admin Users
9.  Permissions
10. Staff Roster
11. Leave
12. Assignment Rules
13. Capacity / Workload
14. Staff Activity
15. Bulk Reassignment

## Services

16. Countries
17. Country Details
18. Services
19. Service Details
20. Sub-services
21. Processing Types
22. Statuses
23. Workflow Builder
24. Service Availability

## Pricing / Vendors

25. Pricing
26. Pricing Detail
27. Pricing History
28. Vendor Rates
29. Vendors
30. Vendor Details
31. Vendor Performance
32. Vendor Recommendation

## Operations Configuration

33. Document Checklists
34. Checklist Rules
35. Quotation Configuration
36. SLA / TAT
37. Assignment Configuration

## Payments / Commercial

38. Payment Gateways
39. Payment Methods
40. Gateway Fees
41. Payment Configuration
42. Coupons
43. Refund Configuration
44. Refund Approval

## Communication / Knowledge

45. WhatsApp
46. Email
47. Notification Rules
48. Templates
49. Knowledge Base
50. FAQ
51. Service Guides
52. Country Guides
53. Document Instructions

## Finance / Reporting

54. Executive Reports
55. Sales
56. Revenue
57. Vendor Cost
58. Profit / Margin
59. Refunds
60. Coupons
61. Expenses
62. Expense Categories
63. P&L
64. Service Analytics
65. Country Analytics
66. Vendor Analytics
67. Staff Workload
68. Export Center

## Platform / Integrations

69. CRM Settings
70. Automation
71. n8n
72. API / Integrations
73. Providers
74. Integration Health
75. OCR
76. OCR Monitor
77. AI Configuration
78. Meta / Google Tracking
79. Tool Health

## Security / Governance

80. Audit Logs
81. Configuration History
82. Access History
83. Security Settings

------------------------------------------------------------------------

# 44. PERMISSION MODEL

Admin permissions should be granular.

Conceptually:

> Admin User → Permission → Module → Resource → Action

Possible actions:

-   View
-   Create
-   Edit
-   Enable
-   Disable
-   Configure
-   Approve
-   Reject
-   Execute
-   Test
-   Publish
-   Export
-   View Sensitive Data

Initially, the Super Admin has all permissions.

When creating another Admin:

> Select the permissions required.

------------------------------------------------------------------------

# 45. IMPORTANT OPEN ITEMS

The following should remain explicitly open rather than invented:

1.  Final advanced vendor recommendation scoring formula.
2.  Exact behavior for unpaid existing work after configuration changes.
3.  Final GST/SAC/tax rules.
4.  Exact future Admin permission templates.
5.  Final production provider selections.
6.  Final customer-safe status mapping.
7.  Exact high-risk action confirmation matrix.
8.  Any additional finance/accounting requirements beyond expense/P&L
    reporting.

------------------------------------------------------------------------

# 46. ARCHITECTURE PRINCIPLES

1.  **Admin controls/configures.**
2.  **CRM operates.**
3.  **Website serves the customer.**
4.  Admin and CRM have separate authentication/access.
5.  CRM staff cannot modify Admin configuration.
6.  Admin configuration should be reusable by CRM and Website.
7.  New countries/services should not require CRM core redesign.
8.  Service workflows are service-specific.
9.  Statuses are service-specific.
10. Pricing is Admin-controlled.
11. Paid bookings retain committed configuration.
12. Vendor cost is internal.
13. PAX is the core workload factor.
14. Admin can manually and bulk reassign open work.
15. Vendor recommendation must consider multiple operational factors.
16. Admin has broad internal data visibility.
17. AI is an Admin command/diagnostic layer.
18. Integrations are first-class Admin-managed capabilities.
19. Audit history is retained for 1 year.
20. No unnecessary configuration duplication inside CRM.

------------------------------------------------------------------------

# 47. COMPATIBILITY CHECK AGAINST CRM

The current architecture is intended to remain compatible with the CRM
specification.

### CRM

> **Staff Operations + Customer Case Processing**

### Admin

> **Configuration + Governance + Control**

### Website / Customer Portal

> **Customer Experience**

The three systems communicate through shared APIs/platform services and
a shared business/data model.

The central compatibility rule is:

> **Admin should be the source of truth for configurable countries,
> services, pricing, vendors, documents, statuses, workflows, roster and
> assignment.**

CRM consumes those configurations and performs operational work.

------------------------------------------------------------------------

# 48. STATUS

**Admin Phase 1 Functional Architecture: Draft for CRM comparison**

No production coding.

No database changes.

No Prisma changes.

No authentication implementation changes.

No final Figma design.

The next step is to compare this Admin MD against the CRM MD and
identify:

-   Conflicts
-   Missing dependencies
-   Duplicate responsibilities
-   Data ownership issues
-   Workflow inconsistencies
-   Permission conflicts
-   Website impact
-   Anything that must be corrected before Figma
