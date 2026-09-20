TRIPNEXIO — MASTER PROJECT OVERVIEW & SOURCE OF TRUTH

Version: 2.0
Status: NEW MASTER — prepared after comparison with the uploaded legacy Master Blueprint and the current approved service/UI MDs.
Current implementation phase: WEBSITE / FIGMA FIRST

1. PURPOSE

This is the high-level Master Project Overview for TripNexio. It defines the final product structure, cross-service journey, source-of-truth hierarchy, important shared rules, protected technical foundation, and current development direction.

It does not contain every CRM field, Admin setting, database column, API or staff workflow. Detailed module MDs remain authoritative for service-specific business rules.

2. SOURCE-OF-TRUTH HIERARCHY

1. This Master Project Overview
   ↓
1. Individual locked Service MD
   ↓
1. Website / UI/UX MD
   ↓
1. CRM / Admin / Technical MD
   ↓
1. Existing code and database

If a detailed locked Service MD is more specific than this overview, the detailed Service MD controls that rule. Do not silently invent or change business rules. If something is genuinely missing, record an OPEN QUESTION.

3. FINAL PRODUCT ARCHITECTURE

TRIPNEXIO
│
├── UAE VISA
│ ├── New Visa
│ ├── Visa Extension
│ └── Visa Change
│
├── FLIGHT TICKET
│ ├── Special Fare
│ └── Return Verified Ticket
│
└── OTB
└── Separate Service / Module

Locked relationship: OTB is separate from Flight Ticket; Return Verified Ticket is under Flight Ticket; the three Visa services remain separate business workflows.

4. PRODUCT POSITIONING

TripNexio is a connected travel-services platform. The customer should experience one company, one journey, one timeline and connected services.

Customer
↓
Website / WhatsApp / Supported Source
↓
Service Selection
↓
Service Journey
↓
Documents / OCR where applicable
↓
Price / Quote
↓
Payment
↓
Booking / Application
↓
Staff Verification
↓
Document Validation
↓
Forwarded
↓
Processing
↓
Outcome
↓
Customer Notification
↓
Completed

5. WEBSITE — CURRENT PRIORITY

Design the Website first. The website must look modern, premium, fast, reliable, travel-focused, AI-enabled and simple. It must not look like an old travel agency, generic chatbot, destination-discovery site, or online live-flight-search marketplace.

Primary navigation:

Visa | Flight | OTB | Track Status | Ask TripNexio AI

Visa exposes New Visa, Visa Extension and Visa Change. Flight exposes Special Fare and Return Verified Ticket. OTB remains separate.

6. CUSTOMER WEBSITE EXCLUSIONS

Do not create these as primary customer website products/pages unless later approved:

Profile

My Bookings

My Documents

Payments

Generic customer dashboard

Generic flight-search marketplace

Hotel booking

Holiday packages

Destination discovery as the main product

Direct permanent WhatsApp floating button

Generic chatbot homepage

The customer website should focus on service journeys and Track Status. Internal Customer 360 is a CRM concept and does not require a customer-facing generic profile/dashboard.

7. ASK TRIPNEXIO AI / WHATSAPP

AI is a supporting feature, not the visual identity of the website.

Ask TripNexio AI
↓
Understand requirement
↓
Guide to correct service
↓
Actual service journey
↓
WhatsApp handoff when appropriate
↓
CRM

AI must never invent price, availability, eligibility, PNR, processing status or refund eligibility. Those values must come from approved service/CRM/Admin rules. Do not place a large direct WhatsApp CTA everywhere.

8. COMMON CUSTOMER JOURNEY

Customer
↓
Website / WhatsApp / Supported Source
↓
Select Service
↓
Existing Customer?
├── YES → Reuse permitted existing data → Ask only missing information
└── NO → Collect required information
↓
Required Details / Documents
↓
Price / Quote
↓
Terms & Conditions
↓
Summary
↓
Payment
↓
Booking / Lead / Application Generated
↓
Staff Verification
↓
Documents Validation
↓
Validated
↓
Forwarded
↓
Processing
↓
Approved / Issued / Rejected / Exception
↓
Customer Notification
↓
Completed

Exact steps vary by service.

9. EXISTING / NEW CUSTOMER

Existing customers should have permitted existing passport, visa, traveller or ticket information reused so they are not forced to re-enter data. Exact reuse rules are service-specific.

New customers provide only the information required by the selected service. Do not create one giant generic form.

10. SHARED PROCESSING LIFECYCLE

Validated → Forwarded → Processing → Outcome

Service

Forwarded To

Processing

New Visa

Embassy / Visa Processing Authority

Visa Processing

Visa Extension

Visa Processing Authority

Extension Processing

Visa Change

Applicable Visa Processing Channel

Visa Processing

Flight Special Fare

Airline / Vendor

Ticket Issuance

Return Verified Ticket

Airline / Vendor

Reservation/Ticket Processing

OTB

Airline / OTB Partner

OTB Processing

Refund rules remain service-specific.

11. UAE VISA

Services:

New Visa
Visa Extension
Visa Change

They remain separate workflows.

New Visa — high level

New Visa → Details → Documents → Price → Terms → Summary → Payment
→ Booking/Lead → Staff Verification → Document Validation
→ Forwarded to Embassy/Visa Authority → Under Processing
→ Approved/Rejected → Customer Notification → Completed

Visa Extension — high level

Existing UAE Visa → Extension Request → Required Visa/Entry Information
→ Expiry/Business Rule Check → Documents → Price → Terms → Payment
→ Staff Verification → Document Validation → Forwarded
→ Processing → Result → Customer Notification → Completed

Visa Change — high level

Visa Change → A2A OR Border Exit → Customer/Traveller Details
→ Existing/New Customer → Required Documents → Staff Checks Availability
→ Availability Added → Customer Selects Date/Time → Terms → Summary
→ Payment → Package Generated → Exit/A2A Processing
→ New Visa Processing → Visa Approved → Visa Delivered → Completed

Detailed Visa MDs remain authoritative.

12. FLIGHT SPECIAL FARE

Special Fare is offline/manual flight fare processing, not an online/live flight search engine.

Flight Special Fare → Origin → Destination → Travel Date
→ Passenger Details → DOB → Adult/Child/Infant
→ Flight Requirement → Lead Generated → Staff Manually Checks Availability
→ Availability Added to CRM → Customer Receives Options
→ Customer Selects Flight → Quote/Fare → Terms → Summary → Payment
→ Booking Generated → Final Availability Confirmation
→ Forwarded to Airline/Vendor → Ticket Issued → Ticket Delivered
→ Customer Notification → Completed

Locked rules

Offline Special Fare only.

No online/live flight search.

Staff manually checks availability.

Airport and Airline Masters are Admin-controlled.

Phase 1 supports major direct India→UAE departure airports and GCC airports.

Maximum travel window: 45 days.

Quote validity is Admin-adjustable, maximum 30 minutes.

Quote reminder every 10 minutes while valid.

Multiple quotes supported; selected quote closes other options.

Expired quote blocks payment and requires a new/reconfirmed quote.

Existing passenger can reuse passport details.

Adult = 12+, Child = 2–11, Infant = under 2, calculated from DOB on travel date.

Baggage is manual.

Alternative route is staff-entered and clearly labelled.

Payment requires a valid quote.

Final availability is confirmed after payment.

Higher alternative → additional payment or refund option.

Lower alternative → applicable difference refund.

No suitable alternative → full refund.

Cancellation refund = paid amount minus applicable vendor/airline and gateway charges.

Follow-up every 7 days until customer stops/books.

Flight is first upsell after New Visa.

Return Verified Ticket and OTB are separate modules.

No Fare Watch.

No public live fare comparison.

Vendor cost and margin are internal.

Never invent availability or fare.

13. FLIGHT MASTER DATA

Airport and Airline Masters must be configurable rather than hard-coded. Phase 1 direction is major Indian airports offering direct India→UAE flights plus GCC airport coverage. Exact operational master records remain Admin configuration.

14. RETURN VERIFIED TICKET

Return Verified Ticket is under Flight Ticket. OTB is separate.

It is a UAE-focused, online-verifiable return/onward ticket reservation service. Customer-facing communication must not guarantee acceptance by every airline, immigration authority or border officer.

Customer provides:

Name

Number of passengers

Visa type

Travel date

Visa type:

30 Days | 60 Days

Customer selects only the travel date. The return/onward date is generated according to the configured visa-type rule.

Timing

Reservation can be issued up to 24 hours before travel.

Once issued, reservation is intended to be valid for the next 24 hours, subject to vendor/airline rules.

CRM stores issue time and expected expiry time.

Processing / refund

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
Ticket Processing
↓
Ticket Issued
↓
PDF Uploaded to CRM
↓
WhatsApp + HTML Email + Customer Portal
↓
Completed

Documents include passport copy, UAE visa copy and applicable onward/return ticket information where not already available.

Before forwarding, cancellation follows the configured gateway-fee refund policy. After documents are validated and forwarded to the airline/vendor: NO REFUND. Ticket issuance is non-refundable.

15. OTB — SEPARATE SERVICE

OTB is not under Flight Ticket. It is an upsell/add-on after New Visa sale, flight/ticket sale, existing customer interaction or new customer interaction.

Rules:

OTB is for Indian passport holders only.

Do not ask nationality.

ECR passport holders may require OTB according to selected airline configuration.

ECNR passport holders do not require OTB.

Some airlines do not require OTB, e.g. Emirates and Etihad.

Admin controls OTB requirement per airline.

Do not claim universally that every Gulf-bound passenger requires OTB.

TripNexio is an official OTB partner.

OTB customer flow

OTB → Existing/New Customer → Airline → Travel Date
→ Internal OTB Requirement Check → Normal/Urgent → Price
→ Terms → Summary → Payment → OTB Booking Generated
→ Staff Verification → Document Validation
→ Forwarded to Airline/OTB Partner → Airline Processing
→ Approved/Rejected/Additional Documents → Customer Notification → Completed

OTB airline master

Searchable master, no free-text airline entry. Relevant Indian and GCC airlines are supported. Admin can add/edit/enable/disable without code changes. OTB Required ON/OFF, pricing, processing configuration, working hours, required documents and airline instructions are configurable.

Example configuration:

Emirates → OTB OFF
Etihad → OTB OFF

OTB requirement check

Do not create a generic customer-facing “Eligibility Check”. Internally check Indian passport scope, ECR/ECNR where available, selected airline, Admin OTB ON/OFF, travel date/time and processing availability. If OTB is not required, inform the customer and do not create a paid OTB application.

OTB customer information

New customer:

Full Name

Mobile

Email

Airline

Travel Date

Existing customer: reuse existing passport/visa where permitted. If flight was purchased elsewhere, ask flight ticket and return ticket. If flight was purchased from TripNexio, reuse it and ask only for return ticket. If return ticket is missing, offer Return Verified Ticket; if accepted, calculate and link both bookings.

OTB documents

Passport front page

Passport last page

Valid UAE visa copy

Flight ticket

Return ticket

If TripNexio already has the flight ticket, do not ask for it again.

Normal / Urgent

Customer sees only:

Normal | Urgent

Do not show internal T+2, 6–48 hour, SLA or working-hour calculations.

Internal rules:

Normal = T+2 working days.

Urgent = urgent processing.

Same-day urgent requires at least 6 hours before departure and applicable working-hour rules.

Travel tomorrow → suggest/show Urgent when Normal cannot meet the requirement.

Travel 2+ days later → Normal can be available.

Only show operationally available options.

16. UPSELL ARCHITECTURE

New Visa
↓
Flight Special Fare
↓
Return Verified Ticket
↓
OTB if applicable

Flight Special Fare
↓
Return Verified Ticket
↓
OTB if applicable

OTB
↓
Return Verified Ticket

If the customer opts out of an upsell, stop that upsell for the current journey. Do not repeatedly push the same offer during that journey.

17. NOTIFICATIONS

Supported channels:

WhatsApp

HTML Email

Customer Portal / Status experience

Typical events:

Lead/booking created

Payment received

Documents required

Documents received

Documents validation pending

Documents validated

Forwarded

Processing

Additional documents required

Approved

Rejected

Ticket issued

Refund initiated

Refund completed

Service completed

Exact notification rules remain service-specific.

18. SHARED PLATFORM / INTERNAL CUSTOMER 360

Shared infrastructure can include customer database, CRM, payment, document storage, OCR where applicable, notifications, WhatsApp, email, customer portal/status, Admin, audit log and vendor management.

Internal Customer 360 should maintain one customer across services rather than duplicate customers. This is an internal CRM/platform concept and does not require a customer-facing generic Profile/My Bookings/My Documents/Payments section.

19. PROTECTED TECHNICAL FOUNDATION

The legacy Master Blueprint documents existing work including service categories/catalog, visa masters, INR, existing airport/airline masters, flight_enquiries, flight_quote_options, automatic margin calculation, Prisma 7, PostgreSQL adapter and existing Express/auth architecture.

Do not rebuild these blindly. Audit current code/database before changes.

20. DATABASE SAFETY

The existing PostgreSQL database predates Prisma migration history. Known condition: no prisma/migrations directory and no \_prisma_migrations table. Flight tables were created directly in PostgreSQL.

NEVER:

npx prisma migrate reset

Do not reset the database, delete existing tables/data, or rebuild from zero.

Before changing a table:

Inspect PostgreSQL
↓
Inspect Prisma model
↓
Understand relationships
↓
Make smallest safe change
↓
Validate
↓
Type-check

21. LEGACY RULES SUPERSEDED BY CURRENT MDs

The uploaded legacy Master Blueprint contains rules that are now outdated and must not be carried forward blindly.

Flight quote

Legacy: 15-minute quote validity.

Current Special Fare MD: Admin-adjustable, maximum 30 minutes, reminder every 10 minutes.

Return Ticket

Legacy: ₹1,000 fixed price and 12-hour cutoff.

Current Return Verified Ticket MD: UAE-focused, 30/60-day visa type, travel date only, issue up to 24 hours before travel, intended 24-hour reservation validity.

Product naming

Use:

Flight Ticket
├── Special Fare
└── Return Verified Ticket

Do not treat old generic “Normal Fare” as a separate approved customer product unless separately approved.

Customer website

Do not carry forward old generic customer Profile/My Bookings/My Documents/Payments sections into the current website design.

22. CURRENT DEVELOPMENT PHASE

SERVICE MDs
↓
MASTER PROJECT OVERVIEW
↓
WEBSITE FIGMA UI/UX MD
↓
FIGMA DESIGN
↓
PROTOTYPE
↓
WEBSITE APPROVAL

Do not begin major CRM/Admin redesign before the website direction is approved.

23. WEBSITE DESIGN SCOPE

The Figma specification must cover:

Desktop homepage

Mobile homepage

Visa service entry

New Visa journey

Visa Extension journey

Visa Change journey

Flight Special Fare journey

Return Verified Ticket journey

OTB journey

Track Status

Ask TripNexio AI

WhatsApp handoff

Forms

Document upload

Summary

Payment

Status timeline

Notifications

Responsive states

Prototype flows

The Website Figma MD is the detailed UI/UX source of truth.

24. DESIGN REFERENCES

Visa2Fly and Atlys screenshots are inspiration only. Use them for visual quality, card treatment, typography, travel imagery, spacing and mobile composition. Do not copy branding, exact colors, text, layout, components, assets or visual identity.

25. IMPLEMENTATION ORDER AFTER WEBSITE

PHASE 2 → CRM Design / Implementation
PHASE 3 → Admin Design / Implementation
PHASE 4 → WhatsApp AI + CRM Integration + Notifications
PHASE 5 → End-to-end testing → Deployment

26. DEVELOPMENT SAFETY RULES

Claude Code must:

Read this Master Overview before major changes.

Read the relevant detailed Service MD before implementing a service.

Never reset the database.

Never run npx prisma migrate reset.

Never delete existing project/production data.

Inspect existing tables before database changes.

Reuse existing models where appropriate.

Do not create duplicate concepts.

Do not hard-code airports or airlines.

Keep service-specific rules separate.

Do not invent live fares or availability.

Do not expose internal vendor cost/margin to customers.

Keep customer-facing statuses simple and internal CRM statuses detailed.

Validate payment server-side.

Run Prisma validation after relevant schema changes.

Run TypeScript checks after relevant code changes.

Keep changes incremental.

Explain changed files after each implementation phase.

Do not modify unrelated modules without approval.

If a rule is missing, create an OPEN QUESTION instead of guessing.

27. CURRENT PROJECT STATUS

This document does not claim that every documented module is currently implemented. Current code/database status must be established by a read-only audit using:

BUILT
PARTIALLY BUILT
DOCUMENTED ONLY
CONFLICTING
NOT BUILT
NEEDS AUDIT

Documentation is not proof that corresponding code is complete.

28. READ-ONLY AUDIT BEFORE IMPLEMENTATION

Before major coding, Claude Code should inspect frontend, backend, routes, controllers, services, Prisma schema, PostgreSQL structure, existing APIs, pages, components, master data and documentation.

Report:

What already exists

What is partially built

What is missing

What conflicts with current approved MDs

What can safely be reused

What needs updating

Exact files that would change

No code changes. No database changes. No migrations. No deletion.

29. DEFINITION OF DONE

A service is not complete merely because an API works.

Customer
↓
Service
↓
Details
↓
Documents where required
↓
Price / Quote
↓
Terms
↓
Payment
↓
Booking / Application
↓
Staff Verification
↓
Validation
↓
Forwarding
↓
Processing
↓
Outcome
↓
Delivery
↓
Customer Notification
↓
Status Updated

Exact workflow differs by service.

30. FINAL PRODUCT PRINCIPLE

TripNexio should not feel like separate products. It should feel like:

ONE TRIPNEXIO JOURNEY WITH MULTIPLE CONNECTED TRAVEL SERVICES.

Shared infrastructure makes the journey connected. Independent Service MDs protect business-rule accuracy. The website remains simple. CRM operates the business. Admin controls configuration. WhatsApp AI assists and routes customers. Automation handles repetitive events. Customers always know what is happening.

31. MASTER DOCUMENT MAINTENANCE RULE

When a new business decision is locked:

Update the relevant detailed Service MD.

Update this Master Overview only if the decision changes cross-service architecture.

Do not duplicate every detailed rule here.

Record major architecture changes in 16_Architecture_Decisions.md.

Keep the Master Overview concise enough for Claude Code to read safely.

32. FINAL SOURCE-OF-TRUTH STATEMENT

This file is the high-level TripNexio Master Project Overview.

Detailed service rules remain authoritative in:

New Visa MD
Visa Extension MD
Visa Change MD
Flight Special Fare MD
Return Verified Ticket MD
OTB MD

Website UI/UX remains authoritative in:

TripNexio_Website_Figma_UIUX_Spec.md

Technical/database implementation remains governed by the existing technical MDs and the actual current code/database after audit.

Never silently replace an approved rule.

Never reset the database.

Never invent missing business rules.

Build incrementally.
