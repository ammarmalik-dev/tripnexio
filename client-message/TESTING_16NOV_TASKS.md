# Client doc 16 Nov 2026 — task checklist

Source: `client-message/new-doc-from-client-16-nov/TripNexio Project.docx` (its first page holds live credentials — never commit it, never copy values out of it except into env vars).
The doc ends with the **final status lists** for Visa / Visa Change / Visa Extension / Flight / Return Ticket / OTB (§S below) — these replace the 20 Oct lists in `src/lib/service-status/catalog.ts` + `template-catalog.json`.

Status 16 Nov: checklist written, nothing started. Questions for the client are in §Q — don't build those items until answered.

## Q. Questions for the client (conflicts / unclear in the doc)
- [ ] Q1 "Quotation Approved" is renamed to **Quotation Selected** in one place and **Package Selected** in another (Visa Change?), while the status list uses **Quotation Accepted**. Which label where?
- [ ] Q2 Quotation statuses: "Sent, Selected, Unpaid, Expired" vs "Selected, Accepted, Expired". Final list?
- [ ] Q3 Return Ticket On Hold message says "issue 12 hours before departure"; the 25 Oct rule was "day before travel". Is it now 12 h?
- [ ] Q4 Return Ticket pricing "Within 20 Days / After 20 Days": 20 days counted from what (travel date → return date)?
- [ ] Q5 Cancellation quotation: is the service charge per passenger or per booking? GST only on the service charge?
- [ ] Q6 OTB "Additional Documents Received / Submitted" are marked "To Configure" — what triggers them?
- [ ] Q7 Coupon accounting: "expense category in P&L considered as sale amount which is paid" — record the discount as an expense with gross sale, or net sale?
- [ ] Q8 Gateway fee by payment method (Card/UPI/Net Banking): Razorpay payment links don't let us pick the method upfront — fee is known only after payment. OK to apply it from the webhook's method?
- [ ] Q9 Removing Admin → Data Export: confirm every export it offered exists on the individual pages first.
- [ ] Q10 Bookings 11026FL112 / FL113 log review: production data — OK to read prod audit logs?

## A. Special Fare (flight)
- [ ] A1 Manual lead: origin city, destination city, return date (round trip)
- [ ] A2 Send multiple quotations in one click (Special Fare + Visa Change only)
- [ ] A3 Email heading: no airline logo of the first quotation
- [ ] A4 Ticket upload: reuse baggage from the quotation, don't ask again
- [ ] A5 Partial ticket issuance → status Partially Issued (CRM + website)
- [ ] A6 Ticket upload: compare ticket details with passenger data; block on mismatch
- [ ] A7 Offline flight lead: Country + Service Type shown in CRM after quotation
- [ ] A8 Flight notifications: city names (Bengaluru → Delhi), not codes; PAX count
- [ ] A9 One-Way / Round-Trip shown with both dates and cities; round-trip quotation (FL113 lost its return date)
- [ ] A10 "Quotation Selected" email: subject / heading / message per doc; selected flight details (airline, flight no., cities, dates, times, PAX) in email, WhatsApp and payment link
- [ ] A11 Seat unavailable: never auto-refund or auto-send alternative; customer chooses Request Refund / Approve Alternative; refund held until choice; extra payment link or balance refund; quotation status updated
- [ ] A12 Ticket cancellation flow (post-issuance only): Ticket Cancellation Requested → Sent to Airlines for Cancellation → Cancellation Quotation (airline fee + admin service charge + GST, company profit to MIS) → customer approval → refund of the remainder → Ticket Cancelled
- [ ] A13 Cancellation request not allowed before ticket issuance (use normal refund flow)
- [ ] A14 Airline Reschedule (accept / refund, new ticket upload) and Airline Cancellation (full refund); P&L updated
- [ ] A15 Travel date auto-updated when the customer accepts a flight option

## B. Return Ticket
- [ ] B1 Travel > 24 h away → task + On Hold + automatic customer message (wording per doc; see Q3)
- [ ] B2 Pricing: Within 20 Days / After 20 Days categories, vendor rates for each, calendar split, auto price (see Q4)
- [ ] B3 Country not repeated in Service Details
- [ ] B4 From OTB: don't ask return ticket again at upload; destination auto-selected with price

## C. OTB
- [ ] C1 Rejected only after Sent to Airlines
- [ ] C2 Additional Documents Sent to Airline only when documents were requested (from Document Master) and uploaded
- [ ] C3 Manual lead: active countries + live airlines only, calendar rules, configured documents auto-fetched (staff upload or notify)
- [ ] C4 No staff refund after OTB approved
- [ ] C5 WhatsApp bot offers Return Ticket in the OTB flow
- [ ] C6 Airline Decision per passenger (Approved / Rejected / Pending)
- [ ] C7 Website abandoned leads captured for OTB

## D. Visa Change
- [ ] D1 Before payment ask only the Visa Copy; after payment never re-ask visa/passport; configured docs after payment
- [ ] D2 Package: staff upload the real package documents (no generated PDF); "Visa Change Package", only after payment
- [ ] D3 Pre-payment website status wrong (no Cancelled / On Hold on a processed booking)
- [ ] D4 Partial visa upload in CRM
- [ ] D5 Manual lead: no travel date; Exit Method (A2A / Border) + Nationality → document checklist; offline lead shows configured documents
- [ ] D6 Travel date = actual exit date (A2A + Border); shown when creating the bus itinerary
- [ ] D7 Proforma: "Fine" (not "Fine / Status-Change Charges"); service fee = configured fee not profit; tax invoice includes the fine
- [ ] D8 Second form page message: "Our team will verify each applicant's visa details before sending your quotation."

## E. Visa Extension
- [ ] E1 Mixed PAX (one TripNexio visa, one external) — allow extension for eligible passengers
- [ ] E2 Quotations only for eligible passengers
- [ ] E3 Calendar: don't block past dates (Visa Change + Extension)
- [ ] E4 Proforma: service charge per Admin config, profit separate
- [ ] E5 Bot: ask total PAX only; fix "TripNexio Visa Not Found"
- [ ] E6 Manual lead: no travel date; passport number per passenger; configured documents auto-fetched
- [ ] E7 No Applied to Embassy before document validation; validated documents not re-requested; download visa/passport copies; reject before expiry date + quotation
- [ ] E8 Workflow: Documents Validated → Expiry Date → Quotation → Payment → Applied → Approved/Rejected; Approved needs Visa PDF; no approval notification before PDF; no direct refund after approval
- [ ] E9 Travel date = applied date

## F. New Visa
- [ ] F1 Page 1 after visa selection: name, mobile, email, first applicant (saved for abandoned follow-up); page 2: applicants (name, DOB, passport expiry, occupation)
- [ ] F2 Under-18 parent/guardian requirement per country (Admin setting)
- [ ] F3 Fix "Invalid option: expected one of FATHER|MOTHER"
- [ ] F4 Booking summary: Visa Fee / Service Charge / Total separately
- [ ] F5 Workflow validation (backend + UI): document actions only on real uploads; additional docs / visa upload / rejection only after Applied; approval needs Visa PDF; no Hold after approval
- [ ] F6 After applied: request only the Visa Copy, not a package
- [ ] F7 Visa Type column shows Tourist / Transit / Any (not "New Visa"); service details: stay, entry (validity only if enabled)
- [ ] F8 Visa Validity: hidden everywhere customer/staff-facing; country-wise Admin toggle (off by default)
- [ ] F9 Pricing form: one form per visa product with all nationality × Adult/Child × Normal/Express prices; filters; remove the separate New Visa button
- [ ] F10 Nationality-wise document configuration; document descriptions everywhere (website, bot, CRM)
- [ ] F11 Service-specific nationalities (only enabled ones, no "All Nationalities")

## G. Status engine & workflow (all services)
- [ ] G1 Replace status lists with §S; remove old statuses (incl. filters/templates); Admin can delete; status config per Service × Country with the workflow shown
- [ ] G2 Take Action button per booking showing only valid actions for service + stage (enforced in backend)
- [ ] G3 Hold only before external processing; no Hold after delivery
- [ ] G4 Additional documents: select documents from Document Master + passengers, one notification; upload → Under Review → validate → resubmit → decision; no visa upload before/under Additional Documents Required
- [ ] G5 Additional Documents Validated only when actually requested + uploaded + validated
- [ ] G6 Embassy Decision per passenger (Approved / Rejected with reason / Pending); Partially Approved only if ≥1 approved
- [ ] G7 Vendor name required when forwarding to embassy
- [ ] G8 Processing (applied) date captured for every service; travel-date rules per service
- [ ] G9 Visa Delivered / Rejected / Additional Docs hidden before Applied
- [ ] G10 Document upload UX: Uploaded / Replace while under review / Validated (locked) / Rejected (replace); OCR review = single Confirm / Reject
- [ ] G11 Website status mapping fixes (Submitted for Processing shown too early; pre-payment statuses)
- [ ] G12 Admin override: no automatic notifications; other validations stay for regular staff
- [ ] G13 Payment cannot be marked completed without real receipt

## H. Cancellation, refunds & partial cancellation (all services)
- [ ] H1 No direct Cancel / Approve / Refund buttons on bookings; only Initiate Refund (booking section)
- [ ] H2 Approved refund → passengers Cancelled everywhere; passenger count, quotations, documents, actions only for active passengers
- [ ] H3 Cancelled booking: block every action (issue, deliver, hold, package, payment status, document requests)
- [ ] H4 Refund Pending: block package / ticket / delivery
- [ ] H5 Refund rejected → booking back to its previous status; resume for passengers not refunded; amount editable + resubmit
- [ ] H6 Refund amount from each passenger's actual fare (Adult/Child), editable, total ≤ collected; show collected per selected passenger
- [ ] H7 Approver: Approve / Reject only; approval sends to gateway automatically (or bank-transfer record); gateway refund ID only; one customer notification
- [ ] H8 Bank-transfer bookings: manual refund (transaction no., date, amount, status), never via gateway
- [ ] H9 Refund table columns (Created By, POC, Service, Type, Method, Collected) + filters
- [ ] H10 Track Refund button opens the refund page
- [ ] H11 Revenue / GST reduced by cancelled amounts; invoice regenerated for remaining passengers; cancellation template names each cancelled passenger
- [ ] H12 After ticket issue / sent to airlines (flight) or OTB approved / visa approved: no direct refund — service cancellation flow only
- [ ] H13 Log review of 11026FL112 (actions after cancellation) — see Q10

## I. Payments, invoices & coupons
- [ ] I1 Offline Bank Transfer in CRM; slip upload; lead stays pending until approver verifies; offline payment records table; switch method before payment
- [ ] I2 Online / Offline choice after quotation acceptance (VC / VE / Flight): bank details, receipt upload, Payment Verification Pending, ops blocked until approved
- [ ] I3 Copy Payment Link fixed; manual-lead payment link delivered (email + WhatsApp) and visible; Offline button stays
- [ ] I4 Booking ID + Lead Code passed to the gateway (visible in its dashboard)
- [ ] I5 Payment link hidden after payment (show Paid)
- [ ] I6 Payment confirmation email + WhatsApp with Upload Documents button
- [ ] I7 Invoice: PAX count only (no "-1" quantity); invoice edit with vendor name + cost → booking + P&L; separate Invoice Edit permission; audit old/new values
- [ ] I8 Proforma: only configured service charge + GST
- [ ] I9 Gateway fees per method; actual vs configured fee in invoice edit; P&L from net received (see Q8)
- [ ] I10 Vendor / sponsor Credit / Paid tracking with outstanding balances
- [ ] I11 Coupons: create from Manual Lead (amount, auto code, applied); New Visa / OTB / Return Ticket only; checkout coupon field; tracking (creator, user, date, POC, used/unused, expiry) in one line; P&L accounting (see Q7)
- [ ] I12 Manual lead for NV / OTB / RT only when pricing is configured; extra charges under Vendor/Airline Fee
- [ ] I13 Extra charges included in Sales Price in P&L

## J. Leads, quotations & sales/ops separation
- [ ] J1 Lead statuses: New, Contacted, Interested, Under Review, User Not Responding (notifies), Unqualified, Converted (auto after paid); follow-up date until converted/unqualified; temperature unchanged
- [ ] J2 Unpaid / abandoned: selecting a quote or reaching the pay page keeps the record in Leads (Unpaid / Payment Abandoned); Booking only after payment (+ approval)
- [ ] J3 Quotations only for SF / VC / VE; payment status shown separately; filters Service / Country / Status / Payment; validity from Admin; quotation history stays in Quotations
- [ ] J4 Separate histories: Lead / Quotation / Booking, no cross-booking mixing
- [ ] J5 Assignment: NV / OTB / RT → Sales POC before payment, Ops after; Flight / VC / VE → Ops; abandoned leads auto-assigned to Sales; manual leads by Super Admin re-assigned after payment; fair round-robin / workload (1-1-1-1)
- [ ] J6 Permissions: Sales vs Operations; separate View All Bookings vs action permission
- [ ] J7 Task auto-assignment by responsibility (sales vs ops)
- [ ] J8 Sales Overview: Converted Leads instead of Qualified; Sales vs Ops dashboard cards/filters per doc
- [ ] J9 Admin Sales Tracker: targets per POC, metrics, filters
- [ ] J10 Entry Source filter (Website / WhatsApp / Manual) on Leads, Quotations, Bookings
- [ ] J11 Manual lead: edit instead of separate Add Passenger
- [ ] J12 WhatsApp bot abandoned leads for every service
- [ ] J13 Reference IDs like Q-6UOFRN → configured serial format; "Booking" instead of "Application ID"

## K. CRM / Admin UI
- [ ] K1 Sticky logo + sidebar; only content scrolls (CRM + Admin)
- [ ] K2 Compact list pages: filters ≤ 2 rows, full width, ≥ 10 rows visible, Express highlight only (no "Normal"), PAX inline — Leads, Quotations, Bookings, Payments, Invoices, Refunds, Tasks
- [ ] K3 POC name column + filter: Tasks, Follow-ups, Documents, Refunds, Invoices, Payments
- [ ] K4 Quick Booking Search icon in those sections + Admin Live Activity, OCR Monitor, Audit Trail; audit filters in one row
- [ ] K5 No number-input spinner arrows
- [ ] K6 Website booking summary centred
- [ ] K7 Customer export; remove Admin → Data Export (see Q9)
- [ ] K8 Visa Entry Type master (+ add button)
- [ ] K9 Pricing Dashboard: "Visa Price Table" (no Extra Charge column, visa product type, vendor cost fix); "All Services Vendor Prices" with filters + full edit; compact By-country spacing
- [ ] K10 Holidays: weekly offs per country; labels India / Destination Country; TAT excludes both countries' holidays
- [ ] K11 TAT fix: Urgent = 8 working hours inside 10:00–19:00 working days (2 Nov 8 PM test gave 4 Nov for both)

## L. Chat, complaints, help desk, knowledge
- [ ] L1 WhatsApp chat: staff notifications for new messages; Bot vs Agent chats separated; chat usable while working elsewhere; auto-assign to the booking's Sales POC
- [ ] L2 Complaint: WhatsApp + email on submit; notify only on Resolved (not Closed)
- [ ] L3 Help desk tickets: ID `TNITXXXX`, email to creator, Admin alert, attachments, Admin ticket management (assign, status Open / In Progress / Resolved, comments, resolution note, history)
- [ ] L4 Knowledge Centre bulk upload (PDF / DOC / DOCX, progress, manage/delete)
- [ ] L5 WhatsApp bot reuses known customer name/email

## M. Notifications & emails
- [ ] M1 WhatsApp booking confirmation not sent for website bookings
- [ ] M2 Delivery emails (ticket / visa / package): distinct Important Information + Disclaimer headings, highlighted opening line
- [ ] M3 Buttons open the right page (Track Booking, View Details, Pay Now — not all to the pay page)
- [ ] M4 Admin templates: filter by Service / Country / Status; on/off per notification and channel; editable before/after-payment content; submission messages; reminder management; Meta template editing guidance; buttons + Stop Reminder link

## N. Automation (doc "Final Automation & Notification Requirements")
- [ ] N1 Every automation: separate email + WhatsApp templates, independent on/off, dynamic variables per doc
- [ ] N2 SLA escalation per service: POC + Admin, repeat interval, further escalation, OFF = silent
- [ ] N3 Payment reminders: VC/VE every 2 h until 18:00 same day; NV/OTB/RT daily; flight quote 10/20 min then every 10 min, expire at 30 min
- [ ] N4 Document reminders 12:00 + 17:00 daily until complete; separate templates
- [ ] N5 OTB upsell UAE/Oman (day after delivery + 2 days before travel, 16:00, max 2, one per passenger)
- [ ] N6 UAE extension reminders (30-day: day 20/25/30; 60-day: 50/55/60; after extension: 25/29), 12:00
- [ ] N7 Visa Extension upsell after Visa Change approval (day 50/55/60), 12:00
- [ ] N8 Return Ticket upsell (3 days + 1 day before travel, 16:00)
- [ ] N9 Coupon automation: direct offers (NV/OTB/RT); unpaid-quotation offers (VC/Flight/VE) twice same day
- [ ] N10 New upsells: Flight → New Visa and New Visa → Special Fare (two triggers, 20:00, one 2 days before departure); lead only when an application starts
- [ ] N11 Staff alerts 11:00 / 15:00 / 18:00 per POC (own items only) + Excel attachment
- [ ] N12 Admin daily report 20:00 (email + one workbook, tab per category)
- [ ] N13 Weekly report Monday 12:00
- [ ] N14 Customer opt-out per booking (all customer reminders/upsells, both channels; staff alerts continue; audited)
- [ ] N15 No automatic booking completion; keep retention/purge settings unchanged

## S. Final status lists (doc §2–§8)
- [ ] S1 Visa, Visa Change, Visa Extension, Flight, Return Ticket, OTB lists exactly per doc (CRM status, customer label, auto/manual)
- [ ] S2 One common User Not Responding and Booking On Hold; "Quotation Sent" / customer "Quotation Ready" for all quotation services
- [ ] S3 Flight: pre-issuance cancellation uses shared Cancelled / Partially Cancelled; post-issuance ends at Ticket Cancelled; Cancelled by Airline / Rescheduled by Airline
- [ ] S4 Refund rules: gateway Refund ID in notification; bank transfer needs transaction no. before approval; remark required
- [ ] S5 "To Confirm / To Configure" rows: no automation until confirmed (Q6)
