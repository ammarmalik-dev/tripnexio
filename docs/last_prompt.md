TASK P01: Payment hardening (money safety).
STATUS: DONE — commit 7cc1063 (2026-09-29). tsc/lint/build pass. Migration 20260929000000_add_payment_webhook_event applied locally only — must be applied to production before deploy. After deploy, production checkout needs all 3 Razorpay env vars set (no mock fallback in production).

1. Mock gateway must never run in production. In src/lib/payments/get-gateway.ts: when NODE_ENV=production or VERCEL_ENV=production and Razorpay keys or webhook secret are missing or start with "TODO", throw a clear configuration error instead of falling back to mock. Remove the committed literal fallback webhook secret completely.
2. src/app/api/pay/[token]/mock-pay/route.ts: return 404 in production regardless of gateway.
3. Razorpay webhook (src/app/api/webhooks/razorpay/route.ts): reject when secret not configured. After signature check, compare paid amount + currency in the payload with the Payment total (in paise) before completePaymentSuccess. Mismatch = audit PAYMENT_AMOUNT_MISMATCH and do not complete. Make it idempotent on the gateway event id.
4. mark-success route: block when payment.method is BANK_TRANSFER (bank transfers must use approve-bank-transfer with payments.approve + slip). Hide "Mark Success Manually" for bank transfers in PaymentPanel.tsx.
5. Expired quote payment: create a shared assertQuotationPayable(payment) check (selected quotation not expired, using isExpiredNow) and use it in GET /api/pay/[token], mock-pay, the Razorpay webhook and POST /api/bookings/[id]/payments for ALL services that have validityExpiresAt. The pay page shows "This quotation has expired." with a WhatsApp Support button when blocked.
6. Paid or selected quotes must never expire: in src/lib/quotations/sync-expiry.ts and src/app/api/automation/quote-expiry/route.ts skip quotations that are isSelected=true or linked to a booking with a SUCCESS payment. No reminders for selected quotes.
7. Payment reminder and payment-received fallback totals must subtract couponDiscount exactly like create-payment.ts (payment-followup route and notify-payment-received.ts).

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P01 payment hardening".




TASK P02: File access, upload limits, rate limiting, Track Status privacy.
STATUS: DONE — commit cdb0852 (2026-09-29). tsc/lint/build pass; 18 HTTP checks passed on a local dev server. Migration 20260929010000_add_rate_limit_and_lead_reference applied locally only — apply to production before deploy. Existing files already under public/uploads (local dev only) are still statically reachable until moved.

1. /api/files/[id]: allow only (a) staff session with documents.view and service scope, (b) customer session that owns the related lead/booking, or (c) a valid pay/quote token tied to that document's lead/booking. Otherwise 404. Detect MIME from magic bytes (not the client value), send X-Content-Type-Options: nosniff, and Content-Disposition attachment for non-images.
2. Local storage must not write under public/uploads. Store outside public and serve only through /api/files. Keep FileBlob behaviour.
3. Server-side size + MIME validation on every upload path: all 6 /api/leads/* intake routes (passportImageBase64, visaImageBase64: max 8MB decoded; jpeg/png/webp/gif/pdf), documents upload, passport-photo, bank-slip, account upload, pay-token upload. Oversize returns 413.
4. Rate limiting that works on serverless: RateLimit table keyed by ip + route + window. Apply to all public /api/leads/*, /api/track, /api/auth/login, /api/auth/register, /api/crm/auth/login, forgot-password routes, /api/ai/ask. Add a hidden honeypot field to all 6 public request forms; reject when filled.
5. /api/track: require the reference plus the last 4 digits of the registered mobile (or the email) before returning data. Exact match on the stored reference (no endsWith). Return masked name only (first name + last initial).
6. Remove console.log of message bodies, recipients and reset URLs from the console email/WhatsApp/SMS senders and the forgot-password route. Log only event type + masked recipient. Stop passing whole error objects with PII to console.error in public routes.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P02 files uploads rate limit track".






TASK P03: Auth, roles and approval safety.
STATUS: DONE — commit d9a7951 (2026-09-29). tsc/lint/build pass; 22 HTTP/unit checks passed locally. Migration 20260929020000_auth_roles_approvals applied locally only — apply to production before deploy. Production needs SEED_ADMIN_PASSWORD only if the seed is ever run there; rotate the existing admin@tripnexio.com password (the old literal is still in git history).

1. Guest claim: registration may claim a password-less guest Customer only after an OTP sent to that customer's existing email is verified (Resend, console in dev). New CustomerOtp table (hashed code, 10 min expiry, max 5 attempts). Never overwrite email/mobile/name of a guest row without verification.
2. Privilege escalation guard: only a user who already has admin.full can grant admin.full to a role or assign a role containing admin.full. Nobody can change their own role.
3. Refunds: add Refund.raisedByUserId (migration; backfill from the AuditTrail CREATE row where possible). Block approval or PROCESSING/COMPLETED transitions when session user = raisedByUserId. paidAmount must be computed from the Payment (amount - couponDiscount + gst + gatewayFee), never from the request body. Sum of non-rejected refunds on one payment can never exceed that. When refunds complete the full amount, move the Booking to REFUNDED.
4. Staff leave: approver cannot be the leave owner. Bank transfer approval: approver cannot be the user who created that bank-transfer payment.
5. Staff password reset: revoke all existing sessions (User.sessionVersion checked in staff-session) and invalidate older reset tokens.
6. next.config.ts security headers: CSP (self, Razorpay checkout, fonts, current image hosts), HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy. Add an Origin check on all state-changing cookie-authenticated API routes (reject cross-site).
7. Escape every variable in src/lib/notifications/render-template.ts and send-password-reset-email.ts. Sanitize staff-composed email HTML (basic tags only).
8. readFileBytes in local-file-storage.ts: allow only /api/files/<id> or local storage paths; no arbitrary http(s) fetch (SSRF).
9. WhatsApp webhook: hard-fail when WHATSAPP_APP_SECRET missing in production, remove the committed literal, dedupe inbound messages by message id.
10. Remove the sample staff password literal from prisma/seed.ts and CLAUDE.md. Seed reads SEED_ADMIN_PASSWORD from env and refuses to run without it. Never print passwords.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P03 auth roles approvals".








TASK P04: Fix values that contradict locked client rules.
STATUS: DONE — commit 78cb828 (2026-09-29). tsc/lint/build pass; 23 checks passed locally. Migration 20260929030000_locked_value_fixes applied locally only — apply to production before deploy (it also inserts the default RefundConfig rows). Notes: New Visa "after 4h but documents not yet validated" keeps the previous ₹250 interpretation (preValidationDeduction, Admin-editable). Visa Change PACKAGE_GENERATED cutoff detects a PACKAGE_PDF document (P09 creates those). OtbRuleConfig and GST production values left for you to set.

1. OTB: DEFAULT_STANDARD_PROCESSING_WORKING_DAYS = 2 (Normal = T+2 working days, OTB.md §7) and DEFAULT_URGENT_PROCESSING_WORKING_HOURS = 8 (Developer Answers §4) in src/lib/otb/processing-rules.ts. Do not touch production rows; I will set OtbRuleConfig in Admin.
2. Flight Special Fare follow-up: FLIGHT_SPECIAL_FARE leads without a booking get a reminder every 7 days until booked, LOST/CLOSED, or opted out (Flight MD §21). Interval Admin-configurable, default 7. Add Lead.followUpOptOut + an unsubscribe link in the message. Other services keep the current lead follow-up.
3. Refund configuration to Admin: new RefundConfig per service (fullRefundWindowHours, postValidationDeduction, noRefundAfter rule). Seed: NEW_VISA 4h full refund minus gateway, then 250 + gateway after documents validated, none after embassy submission; OTB gateway only before validation, 250 + gateway after, none after airline processing; VISA_CHANGE 250 + gateway before package generated, none after (Website Refund Policy); RETURN_TICKET none after forwarding; VISA_EXTENSION Not Accepted = minus gateway, Rejected = none. src/lib/refunds/rules.ts reads this config. Admin page "Refund Configuration" under Payments with confirmation dialog.
4. Document rejection: reason mandatory (min 5 chars) when status = REJECTED. Store Document.rejectionReason, show in DocumentStatusControl, include in the DOCUMENT_REJECTED notification and on /account.
5. Document status transitions enforced in the API: REQUIRED/MISSING -> RECEIVED -> VERIFIED or REJECTED; REJECTED -> RECEIVED.
6. GST: keep code fallback 0. Admin Tax & Fee page shows a warning banner when GST > 0: "Locked client rule: GST stays OFF until the client enables it." I will set production to 0 manually.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P04 locked value fixes".











TASK P05: Website copy corrections to match the locked client docs. The FINAL docx files are in freelancer-chat-all-files/. Read TripNexio_Homepage_FINAL_Locked_Developer_Handover_1of1.docx fully first.
STATUS: DONE — commit f3d622f (2026-09-29). tsc/lint/build pass; homepage, footer, sitemap, /careers 404, New Visa and Visa Extension copy checked on a local production build. Migration 20260929040000_service_cta_label applied locally only — apply to production before deploy (it sets the six CTA labels, and updates the locked card descriptions only where a row still holds the original seeded text). The footer copyright/phone/email now show only when Admin → System Config has companyName/companyPhone/companyEmail set, so fill those in on production. Visa Change Step 1 still says "UAE/GCC airport" (left for P14).

1. Homepage service cards: per-card CTA from a new Service.ctaLabel field (Admin editable). Seed: New Visa "Apply Now", Visa Extension "Extend Visa", Visa Change "Start Visa Change", Special Fare Flight "Get Special Fare", Return Verified Ticket "Get Verified Ticket", OTB - OK to Board "Apply for OTB". Footer services list must read the same DB rows; remove the duplicate descriptions in services-config.ts.
2. Remove AiAskBar from the homepage (locked order: Hero, Services, How It Works, Track, Why, About, Final CTA, Support/Payment, Footer). Keep the /ai page.
3. Hero carousel: remove location captions and landmark names from alt text; keep global imagery.
4. Track section description exactly: "Track your application, documents and status updates in one place."
5. Exact headings: "Explore Our Services", "View All Services", "How TripNexio Works", "A Simpler Way to Travel".
6. Remove "UAE or GCC" / "UAE and Middle East" / "India to the UAE" wording from global pages (new-visa metadata and What-is body, blog description, services index metadata). UAE-specific service heroes keep their locked UAE copy.
7. New Visa: What-is heading "Your UAE visa application, guided end to end" with the locked body from the UAE Visa Page Content doc §2. Final CTA: "Ready to apply for your UAE visa?", line "Choose your visa option, enter your traveller details and complete your application online.", buttons "Apply for UAE Visa" and "Track Application".
8. Visa Extension "What you'll need": Name, Mobile Number, Email Address, Passport Number, Visa Expiry Date only. Final CTA: "Need more time in the UAE?", "Check your extension eligibility and submit your request online.", buttons "Check Extension Eligibility" and "Track Status".
9. Return Ticket "What you'll need": Full name, Mobile number, Email address, Destination country, Number of passengers, Travel date.
10. Delete the /careers page and its sitemap entry. Add /legal/grievance-redressal to the sitemap.
11. Footer copyright name, phone and email read SystemConfig (companyName, companyPhone, companyEmail). If empty, render nothing. No invented "Travel Studio".
12. New Visa value "urgent" is labelled "Express" everywhere (summary step, WhatsApp bot, CRM labels for NEW_VISA). OTB keeps "Urgent".
13. Remove staff-visible dev text: "stub" (payments page), "Phase 5" (BookingDetail), "CRM.md §12" (tasks page), "CRM.md §10" (coupon error message).

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P05 locked copy fixes".








TASK P06: Form and master-data corrections.
STATUS: DONE — commit 490abad (2026-09-29). tsc/lint/build pass; 36 HTTP/unit checks passed locally (plus the bot OTB timeline check). Migration 20260929050000_forms_and_masters applied locally only — apply to production before deploy. It creates VisaType + Nationality (one nationality per existing Country, named after the country), links existing nationality text by name, and inserts the Return Ticket (3) and OTB (4) DocumentRequirement rows. Notes: (a) Production has no visa types until Admin adds them at /admin/visa-types — until then the New Visa form and bot skip the question (dev seed has 2 "Sample Visa Type" rows). (b) Any OTB/Return Ticket DocumentRequirement rows Admin already created in production will now show on the checkout page. (c) New Visa over WhatsApp now sends the prefilled website request link instead of creating a lead, because passport copies can't be collected in chat. The pay-link rule therefore applies to bot OTB and Return Ticket leads. (d) Bot Return Ticket now asks for the destination, which is needed for the price.

1. VisaType master (name, countryId optional, active, displayOrder) with Admin CRUD under Services & Master Data. New Visa step 1 and the WhatsApp bot read it. Delete SAMPLE_VISA_TYPE_OPTIONS and the "Sample categories" caption.
2. Nationality master (name, countryId, active) seeded from the Country list. Visa Change passenger nationality becomes a searchable select. Pricing and document-requirement lookups match on nationality id (case-insensitive name fallback for old rows).
3. Visa Change: show the Adult/Child select for the primary applicant too (default Adult). Cap additional passengers at 8 like other services.
4. New Visa: one age basis. Both the under-18 minor rule and Adult/Child/Infant use age on the travel date.
5. New Visa price preview: add an Infant counter so the preview equals the charged price.
6. Move post-payment document lists out of the hard-coded REQUIRED_DOCUMENTS map into DocumentRequirement rows (serviceType RETURN_TICKET, OTB). Seed Return Ticket: Passport copy required, Return ticket optional ("where applicable"), Visa copy optional (RVT Page Content v3 §7). Seed OTB with its current 4 documents.
7. OTB airline field: searchable combobox (same style as AirportSearchField) over /api/otb/airlines.
8. WhatsApp bot (src/lib/whatsapp-bot): airlines from the Airline table (store code, not label), visa types from VisaType, New Visa either collects per-traveller passport/DOB/occupation like the website or sends the website request link. OTB validates airline + travel date with evaluateOtbTravelDate. Bot leads for New Visa, OTB and Return Ticket end with the same auto-checkout pay link as the website.
9. Customer dedupe: normalise mobile before matching (digits only, keep country code, assume +91 for 10 digits). Passenger match uses passport number first, then name.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P06 forms and masters".












TASK P07: Client-confirmed reference format: 1 + MM + YY + ServiceCode + MonthlySequence, example 10626VI001 (Locked Business Rules v2.0 §4). This is FINAL.
STATUS: DONE — commit f616bf6 (2026-09-29). tsc/lint/build pass. 29 of 30 local HTTP checks passed. The one failure was an 8-request parallel burst where the local prisma-dev Postgres dropped connections (P1017), an environment limit. A direct DB check of 6 parallel transactions got 6 unique, consecutive numbers, confirming the counter is race-safe. Migration 20260929060000_locked_reference_id applied locally only — apply to production before deploy. It does four things: sets Service.referenceCode (VI/FL/RT confirmed; VE/VC/OT, and OS for OTHER, pending client confirmation — editable in Admin → Services); makes Lead.reference unique (only a duplicate old reference, if any exists, gets "-2"); replaces PENDING-xxx booking placeholders with the lead's reference; and gives already-successful payments their existing INV-xxxxxxxx number, so issued invoices never change. New invoices are INV-2026-27-0001 style. A new booking's Booking ID is the reference from creation (a later booking on the same lead gets "-2"). Old NV-/OTB-/TNX- references keep working in Track Status, search and lookups.

- Generate it at Lead creation. The same value becomes the Booking ID after successful payment. No second unrelated ID, no PENDING-xxx placeholder visible anywhere.
- The monthly sequence is SHARED across all services (10626VI001, 10626FL002, 10626RT003), resets every month, minimum 3 digits (grows past 999), and is never reused, even after cancellation, deletion, expiry or refund.
- Race-safe: ReferenceCounter table (period "0626" primary key, lastValue int) incremented with a single UPDATE ... RETURNING inside the lead-creation transaction. Remove the cuid-suffix logic.
- Service code on the Service table (unique, Admin editable). Seed: NEW_VISA "VI", FLIGHT_SPECIAL_FARE "FL", RETURN_TICKET "RT" (client examples); VISA_EXTENSION "VE", VISA_CHANGE "VC", OTB "OT", OTHER "OS" marked "pending client confirmation" in a code comment and Admin help text.
- Month and year use the SystemConfig timezone (IST default).
- Add Lead.reference (unique). On payment success Booking.bookingId = lead.reference. Extra payments and refunds stay under the same reference.
- Existing rows keep their old references (do not rewrite history). Track Status, global search, /account, pay/quote pages and all lookups accept both old and new formats.
- Replace every display of NV-xxxx, TNX-xx-xxxx, PENDING-xxxx (notifications, invoices, CRM tables, track, account, pay page, exports).
- Invoice numbers: persisted sequential numbers (InvoiceCounter per financial year) stored on Payment, never regenerated per request.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P07 locked reference id".













TASK P08: Wire the per-service status engine (CRM.md §14, ADMIN.md §16-17, Locked v2.0 §13). ServiceStatus + ServiceStatusTransition tables and Admin CRUD exist, but no code sets serviceStatusId.
STATUS: DONE — commit 3ae1c22 (2026-09-29). tsc/lint/build pass; 27 end-to-end checks passed locally.

Migration 20260929070000_per_service_status_engine is applied locally only — apply to production before deploy. It is generated from prisma/seed-service-statuses.ts and is idempotent. It:
- inserts every BOOKING status (so production gets them even if the seed never ran there);
- inserts a LEAD-scope list per service, mirroring the lead lifecycle;
- adds "On Hold" for every service and scope, with transitions both ways;
- adds the missing customer-label statuses;
- only fills empty customerLabel/systemEvent values, and never renames or deletes anything;
- backfills serviceStatusId on existing leads and bookings from mapsTo*.

Other notes:
- System events (quotation created/accepted, payment success, documents requested/received/validated) move records forward only, and never out of a terminal status or On Hold.
- To send customers a message on a status, create an email/WhatsApp template for the new SERVICE_STATUS_UPDATE event, then pick it under Admin → Service Statuses → "Notify customer with".
- Track Status shows each service's customer labels, and falls back to the old 5 stages when a booking has no status or is on hold.

1. Every Lead and Booking gets serviceStatusId. New records get the service's first status for that scope. Backfill existing rows by migration using mapsToLeadStatus / mapsToBookingStatus (best match). Never delete data.
2. One function setServiceStatus(entity, status, note, userId, tx): validates against ServiceStatusTransition, writes AuditTrail with old and new status, keeps the coarse LeadStatus/BookingStatus in sync via mapsTo*, and fires the notification configured on that status (add optional ServiceStatus.notificationEvent). System events (quotation created/accepted, payment success, documents requested/received/validated) call it.
3. CRM Change Status (Lead and Booking) shows ONLY the allowed next statuses for that service. Remove the hard-coded global list from the UI.
4. Hold = a per-service status: seed "On Hold" for every service with transitions back.
5. Customer-safe status: /account, /track and customer notifications use ServiceStatus.customerLabel (Admin editable), falling back to current labels when empty. Track Status stages come from the status group.
6. Refund engine reads ServiceStatus.blocksRefund instead of hard-coded PROCESSING/COMPLETED.
7. Customer labels must match the latest client handovers:
   New Visa: Application Received, Documents Upload Pending, Documents Uploaded, Documents Validated, Applied to Embassy, Additional Documents Required, Additional Documents Validated, Additional Documents Submitted, Visa Approved, Rejected.
   Visa Extension: Extension Request Received, Document Validated, Applied to Embassy, Approved, Rejected.
   Visa Change: Visa Change Request Received, Documents Validated, Package Generated, Border Exited, New Visa Applied to Embassy, Additional Documents Required, Additional Documents Validated, Additional Documents Submitted, Visa Approved, Rejected.
   OTB: OTB Application Received, Documents Upload Pending, Documents Validated, Sent to Airlines, Additional Documents Required, Additional Documents Validated, Additional Documents Submitted, OTB Updated.
   Return Ticket: Request Received, Documents Validated, Sent to Airlines, Ticket Issued.
   Special Fare: Quotation Approved, Payment Completed, Documents Validated, Sent to Airlines, Ticket Issued.
   Map these as customerLabel on the existing detailed internal statuses and add any missing ones. Do not delete rows in use.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P08 per-service status engine".














TASK P09: Shared building blocks used by all 6 services.
STATUS: DONE — commit 9970a5b (2026-09-29). tsc/lint/build pass; 31 end-to-end checks passed locally.

Migration 20260929080000_shared_service_blocks is applied locally only — apply to production before deploy.

Notes:
- **Terms:** payment is always blocked until the customer ticks the box. With no Service Terms published, they agree to the general /legal/terms and the booking stores a null version; publish per-service terms at Admin → Service Terms. The server check covers the /pay page and quote approval — a gateway link sent to the customer some other way can't enforce it.
- **Deliveries:** Booking detail → "Deliver to customer" moves the booking to the mapped status (e.g. OTB → OTB Approved). The WhatsApp/email go through the new OUTPUT_DELIVERED event, which needs a template.
- **Calendar:** holidays are Admin-entered; none are seeded. Weekend defaults stay Sat+Sun for both countries until changed in System Config. OTB now uses the INDIA calendar; the New Visa minimum-days rule and the VE same-day warning are left for P10 and P13.
- **Google Sign-In:** needs GOOGLE_CLIENT_ID/SECRET (see .env.example, with redirect <site>/api/auth/google/callback); the buttons stay hidden until they're set. It was only tested in the "not configured" state — no real Google login was possible here.
- **Password reset:** a customer reset does not sign out sessions already open, because customer sessions have no version field.

1. Service Terms: ServiceTerms per service (optional country override) with version, managed in Admin. Mandatory "I agree to the Terms & Conditions" checkbox before payment on /pay/[token] and on /quote/[token] approve. Store terms version, timestamp and IP on the Booking. Server refuses payment without acceptance.
2. Output delivery: Booking detail "Upload & Deliver" per passenger with output types VISA_PDF, EXTENDED_VISA_PDF, TICKET_PDF, RESERVATION_PDF, PACKAGE_PDF, OTB_CONFIRMATION. On deliver: save document, move service status via setServiceStatus, send WhatsApp + Email with a secure link, show on /account and Track Status, store delivery timestamp.
3. Holiday calendar: Holiday model (date, country UAE or INDIA, name, active) with an Admin page. Working-day helper (weekend per country configurable, working hours from SystemConfig) used by OTB, the New Visa minimum-days rule and the Visa Extension same-day warning. Replace the Mon-Fri-only logic in processing-rules.ts.
4. Apply flow: Apply on any service opens a Login / Continue as Guest choice (skipped when logged in). Same journey and data model for both; selected options preserved.
5. Customer forgot/reset password (email token, 30 minutes, single use).
6. Google Sign-In for customers and staff behind env flags (GOOGLE_CLIENT_ID/SECRET). Staff Google login only matches an existing active User email and never creates staff. Hide the buttons when not configured (no toast stubs).

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P09 shared service blocks".










TASK P10: New Visa customer side (UAE Visa Page Content FINAL, New_Visa.md, New Visa Short Handover v2 in freelancer-chat-all-files/).
STATUS: DONE — commit 1fd18ad (2026-09-29). tsc/lint/build pass; 22 end-to-end checks passed locally.

Migration 20260929090000_new_visa_customer_side is applied locally only — apply to production before deploy. It:
- allows several New Visa products per country (stayDays 30/60 + Single/Multiple entry);
- lets a PricingRule target one product (country-wide rules still apply as the fallback);
- adds the min-days settings to Timelines;
- fills in stay/entry from existing text where it's unambiguous.

Notes:
- An existing production product whose entry text reads "Single Entry / Multiple Entry" keeps an empty entry type — set it in Admin → New Visa Countries.
- The minimum-days rule counts UAE working days; set UAE holidays and weekend under Holidays / System Config.
- Passport expiry is a new optional field per traveller. Expiry within 6 months of the travel date (entered, or read by OCR) shows a warning and creates a HIGH-priority staff task; it never blocks the request.
- "Use existing" reuses a passenger's upload from the last 90 days and only happens on the customer's click.
- File deletion now skips any file another record still uses; the retention job was reordered to match.
- Protection Plan lines on the summary are left for P12.
- The CRM Manual Lead form still prices New Visa with country-wide rules only (P11 staff side).

1. Product selector: selectable Stay Duration (30 / 60 days) and Entry Type (Single / Multiple) from active NewVisaCountryConfig rows, one row per country + duration + entry type, each option showing its price from PricingRule. Admin allows multiple configs per country.
2. Travel date rule: Normal needs travel date at least 7 days ahead, Express at least 3 days (Admin-configurable defaults, computed with the P09 working-day helper). Disable the processing option that cannot meet the date, with a clear message.
3. Summary step: passenger-wise price lines (Adult / Child / Infant), Protection Plan per eligible passenger (P12 will add the plan), GST and fee lines from a server preview endpoint, total payable.
4. Passport validity: when OCR or entered expiry is within 6 months of the travel date, show a warning (not a block) and create a staff Task "Passport validity under 6 months".
5. Returning passenger: if a matching passenger uploaded passport front / photo within the last 3 months, show "Use Existing / Upload New" on the pay page. Never reuse without the customer's click.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P10 new visa customer side".







TASK P11: New Visa staff side.
STATUS: DONE — commit bdb2b7d (2026-09-29). tsc/lint/build pass; 24 end-to-end checks passed locally, covering documents → Ready → Applied → Additional docs → Re-submitted → Approved → visa PDF → Completed, plus a rejection with the reason shown on Track Status.

Migration 20260929100000_new_visa_staff_side is applied locally only — apply to production before deploy. It adds Booking.appliedToEmbassyAt/visaRejectionReason and Document.requestReason, tags the New Visa statuses with the embassy actions (empty systemEvent only), and adds the staff transitions.

Notes:
- Embassy actions follow the configured transitions — e.g. "Applied" works only from Ready for Submission. Ready for Submission is reached by all documents being verified, or by the action if a transition exists.
- New workflow "document-reminder" (n8n/workflows/document-reminders.json, daily 11:00 IST): import it into n8n.
- DOCUMENTS_REQUIRED now also passes {{requestReason}} and {{uploadLink}}; add them to the template if wanted.
- Track Status now reads the latest booking even when it's cancelled, so rejected or cancelled bookings show their closed message.

1. Lead detail and Booking detail show every applicant: name, passport, DOB, occupation, pax type, guardian name, guardian passport, relationship.
2. Embassy actions on the Booking through setServiceStatus: Ready for Submission, Applied to Embassy (stores Applied to Embassy Date), Additional Documents Required, Re-submitted, Visa Approved, Rejected (mandatory reason, shown to the customer).
3. Custom document request: staff adds document name + reason per passenger. Creates a REQUIRED Document, a DOCUMENTS_REQUIRED notification with secure upload link, and a Task.
4. Daily document reminder job /api/automation/document-reminder for all services: every 24h while any document is REQUIRED, MISSING or REJECTED on a non-terminal booking; stops on upload, verification or cancelled request. Add it to workflows.ts and n8n/workflows.
5. Visa Approved requires VISA_PDF upload via P09 delivery, then Visa Delivered, then Completed.
6. Booking shows Booking Date, Applied to Embassy Date and Travel Date separately.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P11 new visa staff side".







TASK P12: Protection Plan. Client confirmed: keep it, and Admin must be able to enable/disable it country-wise.
STATUS: DONE — commit bc7bfd9 (2026-09-29). tsc/lint/build pass; 54 HTTP/DB checks passed locally (one booking-detail read hit the known local prisma-dev connection drop and was re-verified directly). Migration 20260929110000_protection_plan_country applied locally only — apply to production before deploy; it enables the plan for every country that already has a New Visa configuration (keeps today's behaviour). Real Protection Plan terms text is still the SAMPLE seed — client must supply it. Plan refunds need two people (decider raises, another refunds.approve user processes), per P03.

1. ProtectionPlanCountry (countryId, enabled, price override, terms override). Admin Protection Plan page gets a per-country table with an enable toggle and price. Offer the plan only when it is enabled for the booking's destination country. When disabled: no offer and no ProtectionPlan rows.
2. Customer: per eligible passenger opt-in on the New Visa summary step, full terms shown, acceptance mandatory. Price per passenger added to the payable total as a separate invoice line "Protection Plan".
3. Payment: purchased plans are included in the payment total. On payment success mark them PURCHASED with termsAcceptedAt. A later staff purchase is an extra payment on the same booking.
4. Eligibility: an OCR flag or staff flag creates Task "Protection Plan Review"; staff sets Eligible / Ineligible with a note.
5. Visa Rejected with a purchased plan creates Task "Protection Plan Refund Review"; manager/admin decides; approval raises a Refund for that plan amount using the P03 approval rules.
6. Booking view shows passenger-wise Visa status and Protection Plan status side by side; customer sees both on /account and Track Status.
7. The public UAE Visa landing page does not advertise the plan (Page Content §14); it appears only inside the application flow.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P12 protection plan country-wise".








TASK P13: Visa Extension remaining items (Visa_Extension.md, Extension Page Content FINAL, Extension Handover).
STATUS: DONE — commit b59b9e7 (2026-09-29). tsc/lint/build pass; 36 HTTP/DB checks passed locally (two booking-detail reads hit the known local prisma-dev connection drop and were re-verified directly). Migration 20260929120000_visa_extension_remaining applied locally only — apply to production before deploy. The 6:00 PM deadline uses the Admin-configured timezone offset (SystemConfig, one global value — currently IST); set a UAE offset there if the deadline should be UAE time. Day-25 reminder stop rules: opt-out via the existing follow-up unsubscribe link, a later completed extension, or a later visa change by the same customer.

1. POST /api/quotations for VISA_EXTENSION is blocked unless the staff verification outcome is ELIGIBLE or URGENT_TODAY.
2. Website no-match routing: after submission run the prior-TripNexio-visa lookup per applicant passport. If none is found show "We currently provide visa extension services only for visas issued through TripNexio." with buttons "I'm inside the UAE" (to Visa Change) and "I'm outside the UAE" (to New Visa). Keep the lead with flag noPriorVisa for staff.
3. Booking.originalBookingId (nullable FK) set from the matched NEW_VISA booking, visible both ways in CRM.
4. URGENT_TODAY: show the 6:00 PM same-working-day deadline; if the next day is a UAE or India holiday (P09 calendar) show an extra urgent warning to staff and on the customer quote page.
5. Outcomes: Extended -> EXTENDED_VISA_PDF via P09 delivery -> Visa Delivered -> Completed. Route Not Accepted and Rejected through setServiceStatus.
6. Day-25 reminder anchored on verifiedExpiryDate (fallback customer date), one reminder, stops on opt-out, completed extension or visa change.
7. Customer quote page shows: duration 30 days, extension fee, fine, other charges, total, payment deadline (24h link), "new validity counted from the original visa expiry date".

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P13 visa extension".














TASK P14: Visa Change remaining items (Visa_Change.md v3, VC Page Content V3, VC Handover).
STATUS: DONE — commit 75d3eb8 (2026-09-29). tsc/lint/build pass; 38 HTTP/DB checks passed locally, package PDF rendered and visually checked (A2A + Border). Migration 20260929130000_visa_change_remaining applied locally only — apply to production before deploy. Existing Border details saved before P14 lack travel time, so those leads must be re-confirmed before quoting. Package instructions are staff-entered (panel); no instruction copy was invented.

1. A2A staff panel on the Lead (like the Border panel): Entry Airport and Exit Airport from the common Airport master (activeForA2AEntry / activeForA2AExit), Airline from the Airline master, flight number, date, time, reporting time, vendor, cost, selling price. Mandatory before an A2A quotation can be sent.
2. Each quotation option carries either the A2A block or the Border block (border name, pickup location, pickup person, pickup contact, reporting time, travel time, drop location, bus/operator). The customer /quote page shows the right block per option and the customer picks one.
3. Package PDF (pdfkit, brand styled) for A2A and Border with every field from Visa_Change.md §21, generated only when payment is received, operational details are complete and documents are verified. Delivered via P09.
4. Staff actions: Exit Completed (exit date/time, method, airport or border, staff, notes; customer uploads nothing) -> New Visa Processing -> Additional Documents Required -> Visa Approved (VISA_PDF delivery) or Visa Rejected (reason).
5. Refund uses RefundConfig from P04 (250 + gateway before package generated, none after).
6. Keep documents before lead (current behaviour) and also allow post-payment additional document requests.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P14 visa change".










DEPLOYED (2026-09-29): P01–P14 are live on https://tripnexio.vercel.app (Vercel deployment tripnexio-r4e90w0e0). Production (Neon) backed up first (E:\TripNexio-backups\prod-backup-2026-09-29T15-53-27-590Z.json.gz, 53 tables / 1,340 rows), then the 14 migrations 20260929000000…20260929130000 applied with prisma migrate deploy — no failures, row counts unchanged. Vercel is NOT connected to GitHub: deploy with `npx vercel --prod` (after `npx vercel login`) or connect the repo in Vercel → Settings → Git.

TASK P15: Flight Special Fare quote and customer side (Flight MD, FSF Page Content FINAL, Special Fare Handover, Locked v2.0 Q16-Q18).
STATUS: DONE — commit 062d27a (2026-09-29). tsc/lint/build pass; 39 HTTP/DB checks passed locally, customer quote page (countdown, alternative label, cancellation terms, expired state + Request New Quote) checked visually in Chrome. Migration 20260929140000_flight_quote_customer_side applied locally only (not yet on production). Staff are notified of a new-quote request by Task + system-alert email (SystemConfig.systemAlertEmail must be set; no in-app staff notifications exist yet — P22). Post-ticket offer = Return Ticket / OTB links on the customer's pay page and account + one staff Task, opt-out stored per lead.

1. Quotation fields (migration): terminal, reportingTime, fareRules, restrictions, vendorReference, bookingDeadline, cancellationAllowed, cancellationCharge, chargeBasis, timeCondition, noShowCharge, estimatedRefund, customerCancellationPolicy. Add them to the quote builder. The customer quote card shows the customer-facing ones and never vendor cost, margin or vendor reference.
2. Alternative route label on the customer card: "The requested X -> Y route is not available. This is an alternative route from A -> B."
3. Live mm:ss countdown on /quote/[token]. At expiry show "This Special Fare quotation has expired." with a "Request New Quote" button that flags the lead, creates a staff Task and notifies staff. Staff then revalidates (existing) or builds a new quote.
4. Quote shows passenger count by Adult / Child / Infant.
5. Recognised customer: pick saved passengers and answer "Reuse passport details? Yes / No".
6. After ticket issued: offer Return Verified Ticket and OTB (link + staff Task). Store opt-out per lead so the same offer is not repeated in that journey.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P15 flight quote customer side".










TASK P16: Flight Special Fare post-payment operations.

1. After payment the booking moves to "Final Confirmation". Staff action "Confirm Availability" continues; "Unavailable" opens the alternative flow.
2. Alternative flow: staff enters an alternative option (same quote fields, new fare). System computes the difference:
   Higher: customer gets a link with "Pay Additional Amount" (extra payment on the same booking) or "Request Refund" (full refund raised). Never force the higher fare.
   Lower: difference refund raised automatically (still needs approval).
   No suitable alternative: full refund raised.
3. PNR and Ticket Issued are separate states: "Record PNR" (PNR, vendor reference), then "Issue Ticket" (ticket number per passenger, issue time, TICKET_PDF upload, baggage) -> P09 delivery -> Completed.
4. Cancellation refund calculator prefilled from the quote's cancellation charge and the stored gateway fee.
5. Use the existing seeded statuses: Final Confirmation, Alternative Offered, Additional Payment Pending, Refund Pending, Ticket Issued.
6. Phase 1 analytics page: enquiries, quotes created/sent/expired, new quote requests, bookings, conversion %, average response time, average selling price, average margin (admin only), top routes, top departure airports, best vendors, staff conversion, 7-day follow-up conversion, refunds.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P16 flight post payment".

STATUS: DONE — commit e52e8b3 (2026-09-29). Final Confirmation on payment; Confirm Availability / Unavailable (higher → customer pay-or-refund link, lower → auto difference refund, none → full refund); separate PNR Recorded + Issue Ticket (ticket no. per passenger, baggage, TICKET_PDF delivery); refund calculator prefilled; Special Fare analytics at /crm/analytics/special-fare (margin admin/finance only).










TASK P17: Return Verified Ticket remaining items.

1. Booking detail "Issue Reservation" button using the existing issue-reservation API (only within 24h before travel), showing issue time and expected expiry. Then RESERVATION_PDF upload + P09 delivery; status Ticket Issued.
2. Cancellation fee per destination (ReturnTicketDestination.cancellationFee) in Admin, shown on the form summary and pay page before payment. Refund engine uses it before forwarding; no refund after forwarding.
3. Auto-complete job: bookings move to Completed when the travel date has passed (plus Admin-configured days) and the ticket was delivered. Add to workflows.
4. OTB link: Booking.linkedBookingId set both ways when the ticket is bought from the OTB flow or linked by staff. "Issue Reservation" is blocked until the linked OTB is approved (CRM.md §15). Cross-timeline audit entries on both bookings.
5. Staff sees vendor, vendor cost, vendor reference and PNR on the booking.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P17 return ticket".

STATUS: DONE — commit 0a3f368 (2026-09-30). Issue Reservation panel on Booking detail (24h window, issue time + internal expiry, blocked until a linked OTB is approved) -> Ticket Issued; RESERVATION_PDF only after issue -> Delivered; destination cancellation fee (Admin, per booking) shown on form summary + pay page and deducted by the refund engine before forwarding, no refund after forwarding (hard rule); auto-complete job /api/automation/return-ticket-auto-complete + n8n JSON (Admin → Timelines "Auto-complete: days after travel date"); Booking.linkedBookingId both ways with cross-timeline audit (staff "Link" panel on OTB + RT bookings; P18 reuses linkServiceBookings for the combined checkout); vendor/vendor cost/vendor reference/PNR panel. 27/31 scripted checks passed + 4 refund-rule unit checks; the 4 misses were 2 test-assertion bugs (201 vs 200; ₹300 fee > ₹102 paid correctly clamped to 0), 1 unchanged audit-verified flow, and the known local PGlite crash on GET /api/bookings/[id]. Migration 20260929160000_return_ticket_remaining local only. Cancellation fee is not seeded — Admin must set it per destination.











TASK P18: OTB remaining items (OTB.md, OTB Page Content v3, OTB Handover, Developer Answers §4).

1. Staff actions through setServiceStatus: Staff Verification, Submitted to Airline (timestamp), Airline Processing, Additional Documents Required (from airline), OTB Approved (mandatory OTB PNR/reference, approval timestamp), OTB Rejected (reason; no refund after airline processing), Unable to Process (reason, triggers refund; never labelled as airline rejection).
2. On OTB Approved: WhatsApp + Email "Your OTB PNR has been approved by the airline." with the reference, /account and Track Status updated, plus a return-ticket offer when none exists.
3. OTB form answer "No return ticket": offer adding a Return Verified Ticket in the same checkout (destination rate x applicants). Create both bookings linked (P17 link); ticket issue blocked until OTB approved.
4. Recognised customer: offer reuse of stored passport + visa. If their flight was bought from TripNexio, skip flight ticket upload and ask only for the return ticket.
5. Pricing by airline + destination country + pax type (new OtbPrice table with normal/urgent prices; fallback to airline price). The service card shows "Starting from ₹X" using the lowest active price.
6. OTB hero shows an "Official OTB Partner" badge.
7. Per-airline TAT overrides use the P09 working-day + holiday helper.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P18 otb".

STATUS: DONE — commit fe85e4e (2026-09-30). OTB actions panel on Booking detail via the status engine (Staff Verification, Submitted to Airline + timestamp, Airline Processing, Additional Documents Required, OTB Approved with mandatory PNR/reference + timestamp, OTB Rejected = no refund, Unable to Process = TripNexio reason + PENDING full refund, only before airline processing); OTB_APPROVED WhatsApp+email with the client wording + reference + Return Ticket offer (templates seeded in migration + seed), /account and Track Status show the reference, customer label "OTB Approved"; "No return ticket" can add a Return Verified Ticket to the same order (own booking + payment, linked both ways, RT pay link shown on the OTB pay page, issuance blocked until OTB approved); recognised customer: passport + visa reuse offered, flight-ticket upload not required when their flight was a delivered TripNexio Special Fare, return-ticket upload not required when linked; OtbPrice table + Admin → OTB Prices (airline + destination + pax type, fallback to airline price), per-applicant pax type on the form, "Starting from ₹X" on the OTB card; "Official OTB Partner" hero badge; expected completion from per-airline TAT via the P09 working calendar (addWorkingDays/addWorkingHours). 30/30 scripted checks passed locally. Migration 20260930090000_otb_remaining local only. No OTB prices seeded — Admin must add them.











TASK P19: Complete all 6 service landing pages with the locked content. Source docs in freelancer-chat-all-files/:
TripNexio_UAE_Visa_Final_Developer_Handover_Content_Design_FAQ.docx
TripNexio_UAE_Visa_Extension_Final_Page_Content_Design_FAQ_FINAL.docx
TripNexio_Visa_Change_Final_Page_Content_Design_FAQ_FINAL_V3.docx
TripNexio_Flight_Special_Fare_Final_Page_Content_Design_FAQ_FINAL.docx
TripNexio_Return_Verified_Ticket_Final_Page_Content_Design_FAQ_FINAL_v3.docx
TripNexio_OTB_Final_Page_Content_Design_FAQ_v3.docx
Extract and read each file fully before editing.

Add every missing section, in the doc's order, with exact copy:
- New Visa: What You'll Need + Documents Required (3 cards + note), Travelling With Children, Processing Time (Normal / Express cards), Visa Validity & Stay, Important Before You Apply.
- Visa Extension: Extension Details cards, Important cards (3), Documents, Payment, After Payment, Outcomes.
- Visa Change: Where Can I Apply (Inside UAE only card), method cards, Who Can Apply, Documents cards, Pricing (nationality table), Confirmed Options, Before / After Payment, After Exit.
- Special Fare: What Is a Special Fare, 3 fare cards, Passenger Types, Multiple Options, Quote Validity, Alternative Route, After Payment, Baggage, Cancellation & Refund, Ticket Delivery, Follow-up.
- Return Ticket: Documents Required, Verification (PNR), Issue Timing, Cancellation & Refund, Travel & Immigration Disclaimer, After Travel.
- OTB: Pricing table (from DB), Need a Return Ticket, OTB Approval, Cancellation & Refund.

Service FAQ on every page: accordion (2 columns desktop, 1 mobile, "View all") reading the Faq table filtered by service (add a service field and backfill if missing). The OTB doc's FAQ has question/answer pairs shifted by one; pair them correctly by meaning.
Prices, documents and timelines inside these sections come from Admin config where the doc says configurable. Reuse existing section components and brand tokens.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P19 service pages content".

STATUS: DONE — commit af77d62 (2026-09-30). All 6 landing pages completed with the locked doc copy, in doc order (section components under src/components/services/<service>/landing/). Admin-driven values read server-side with safe fallbacks: New Visa min travel days (ServiceTimelineConfig), Visa Extension payment-link hours, Special Fare quote validity + follow-up interval, Visa Change nationality price table (PricingRule, vendor cost never read), Return Ticket documents (DocumentRequirement) + per-destination price/cancellation fee, OTB airline price table. Shared ServiceFaqSection/ServiceFaqAccordion (2 cols desktop, 1 mobile, "View all") reads Faq by serviceType on every page; OTB FAQ (26) added with pairs corrected by meaning (doc listed each answer above its question; Q9 answer from doc §7, Q12 from §8); migration 20260930120000_service_faqs inserts all 150 service FAQs idempotently (same ids as db:seed, ON CONFLICT DO NOTHING) so production gets them. Pages revalidate every 300s. Judgment calls: Visa Extension "Pay Now" card links to the request + Payment Support (no payment exists on a landing page); "vendor" wording kept as "partner" per the site-wide rule. Rendered and visually checked locally (OTB pricing + FAQ in Chrome).










TASK P20: Common website pages (TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx).

1. /contact page with support email, phone/WhatsApp and address from SystemConfig (render only filled fields) and a contact form that creates an OTHER lead.
2. /support overview page and /whatsapp-support page with content from doc §4 and §6; footer links point to them.
3. Cookie consent banner: Accept All / Reject Non-Essential / Manage Preferences, choice stored, optional scripts blocked until consent, cookie inventory kept in a config file.
4. not-found.tsx, error.tsx, global-error.tsx, loading.tsx in brand style.
5. ServicesGrid and every DB-driven public component catch DB errors and render a safe fallback so prerender/build never fails on a dropped connection.
6. Legal placeholder values (jurisdiction, grievance officer name/email/phone/address, legal entity, GSTIN) become SystemConfig fields editable in Admin; legal pages read them.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P20 common website pages".

STATUS: DONE — commit 188d527 (2026-09-30). /contact (support email/phone/WhatsApp/address from SystemConfig with the published site contacts as fallback; legal entity + GSTIN only once filled) + contact form creating an OTHER lead (zod + RHF, honeypot, rate limit); /support (doc §4) and /whatsapp-support (doc §6); header/footer Contact → /contact, WhatsApp Support → /whatsapp-support, Services footer column removed per doc §15; cookie consent banner (Accept All / Reject Non-Essential / Manage Preferences dialog, first-party consent cookie, <ConsentGate> for optional scripts, footer "Cookie settings"), inventory in src/lib/cookies/inventory.ts (only necessary technologies are live today); branded not-found / error / global-error / loading; ServicesGrid falls back to a static list and /faq to its empty state on DB errors (all other public DB reads already guarded) — /faq now lists general FAQs only (service FAQs are on service pages); SystemConfig legal fields (legal entity, GSTIN, jurisdiction, grievance officer name/email/phone/address) editable in Admin → System Configuration, blank = hidden, Terms + Grievance pages read them (no placeholders on the live site). 18/18 scripted checks + Chrome visual check. Migration 20260930140000_system_config_legal local only.










TASK P21: Internal Dashboard gaps part 1 (TripNexio_Internal_Dashboard_All_Requirements_Merged.docx, CRM.md).

1. Customers page (replace "coming soon"): list + search by name, mobile, email, passport, reference. Customer 360 detail page: leads, bookings, passengers, quotations, payments, refunds, documents, communications, notes, follow-ups, timeline.
2. Failed-payment bookings appear in Leads with a "Payment failed" flag and filter.
3. Special Fare, Visa Extension and Visa Change full-form submissions appear in the Quotations queue as "Awaiting quotation". Abandoned forms (step-1 data saved on Next) create a Lead.
4. Leads pagination, Bookings service filter, date filter on Documents and Tasks.
5. Booking detail: vendor section, full timeline, service-specific date labels (CRM.md §12).
6. Urgent badge for Express / same-day visa and urgent OTB rows in lists and Most Action Required.
7. Sidebar items filtered by the user's permissions.
8. Every CSV export writes an audit row (user, filters, row count) and has a row cap.
9. Delay Analysis page (delay = booking past ServiceTimelineConfig expectedCompletionHours or document verification SLA): totals, open, resolved, average duration, breakdown by service/staff/vendor/reason, table linking to bookings. Fill the Delayed and Staff Action Required KPIs.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P21 dashboard part 1".

STATUS: DONE — commit d376c11 (2026-09-30). 1) /crm/customers list (search name/mobile/email/passport/lead or booking reference, server pagination) + Customer 360 (/crm/customers/[id]: leads, bookings, passengers, quotations without vendor cost/margin, payments, refunds, documents, communications, follow-ups/tasks, timeline; per-section permission gating, service-scoped) — no Note model exists, so "notes" = tasks/follow-ups. 2) Leads "Payment failed" badge + filter (latest booking's latest payment FAILED or EXPIRED). 3) /crm/quotations "Awaiting quotation" tab (Special Fare / Visa Extension / Visa Change leads with no quote); abandoned forms: POST /api/leads/draft on leaving the contact step creates one draft lead per customer+service (no notification, "Abandoned" badge), the full submission completes that same lead in place; drafts excluded from lead follow-ups. 4) Leads pagination, Bookings service filter, Documents + Tasks date filters. 5) Booking detail: labelled service dates (CRM.md §12), vendor card (vendor, cost/margin internal, reference/PNR), full timeline (booking+lead+quotes+payments+refunds+documents, capped 300). 6) Urgent badge (New Visa Express / urgent OTB) in Leads, Bookings and Most Action Required. 7) CRM + Admin sidebars filtered by permissions; /admin lands on the first permitted screen. 8) All 11 CSV exports: 10,000-row cap (X-Export-Truncated header), X-Export-Row-Count, audit row with user/filters/count. 9) /crm/delays Delay Analysis (completion SLA + document-verification SLA from Timelines config; totals/open/resolved/avg; by service/staff/vendor/reason; table) + live Delayed / Staff Action Required KPIs. 19/19 scripted checks passed locally. No schema change. Gap: Visa Extension "extension required date" and Visa Change visa number/required date aren't collected at intake, so those booking date rows show "Not recorded".









TASK P22: Internal Dashboard gaps part 2.

1. Staff notifications feed (topbar button, not a bell icon, per CRM.md §4) with unread count and optional sound toggle. Events: new lead, new booking, quotation accepted, payment received, document uploaded, document rejected, refund raised, follow-up due, delay.
2. Help / Need Help page: search Knowledge Centre + FAQ, contact admin, report issue form.
3. CRM Reports page: KPIs, booking analytics by service/status, lead conversion, refund report, staff workload, service mix (no vendor cost or margin for non-admins).
4. Manual task creation from the Tasks page and from Lead/Booking detail.
5. Profile page: details, change password (current / new / confirm), security question setup.
6. Staff Vendors view: read-only list and compare (services, processing time, availability, score). Cost visible only with a vendors.viewCost permission.
7. Quotation edit UI (draft / revise before sending) and a multi-sector itinerary builder for Visa Change and Flight quotes.
8. Roster: StaffRoster (user, service, day of week, active) managed in Admin. Auto-assign new leads to the eligible rostered staff with the lowest PAX workload (Admin on/off toggle). Manual reassignment keeps a reason.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P22 dashboard part 2".

STATUS: DONE — commit 0e916e0 (2026-09-30). 1) Staff notifications feed: StaffNotification model, notifyStaff() + triggers (new lead, new booking, quotation accepted, payment received, document uploaded/rejected, refund raised; follow-up due + delay via new hourly /api/automation/staff-alerts + n8n JSON), topbar "Notifications" button (not a bell) with unread count, mark read, Web-Audio sound toggle saved per user. 2) /crm/help: search Knowledge Centre + FAQ, contact admin (SystemConfig alert email), report-an-issue → SUPPORT_REQUEST task. 3) /crm/reports: KPIs, bookings by service/status, conversion by service/source, refunds, staff workload (PAX), service mix; cost/margin only with finance.manage. 4) Manual tasks (POST /api/tasks, type MANUAL) from Tasks page + Lead/Booking detail. 5) /crm/profile: details, change password (bcrypt, invalidates other sessions, keeps this one), security question (hashed answer). 6) /crm/vendors read-only list + compare (2–4); average cost only with the new vendors.viewCost permission. 7) Quotation drafts (Save as draft / Send), edit, revise-in-place with revision number + re-notify, drafts invisible/unselectable/unbookable for customers, multi-sector itinerary builder for Visa Change + Special Fare shown on the CRM card and customer quote page. 8) Admin → Staff Roster (weekday × service grid) + auto-assign toggle: new leads go to the eligible rostered staff member with the lowest PAX workload (audited AUTO_ASSIGN); manual reassignment requires a reason (lead + bulk). Migration 20260930160000_dashboard_part2 (StaffNotification, StaffRoster, User security/sound, SystemConfig.autoAssignLeads, Quotation draft/revision/itinerary with sentAt backfill, TaskType MANUAL/SUPPORT_REQUEST, vendors.viewCost permission row) — local only. 22/22 scripted checks passed.












TASK P23: Admin gaps part 1 (TripNexio_Admin_FINAL_Developer_Handover_All_Corrections.docx, Locked v2.0).

1. One central "Service Configuration" hub: choose service (+ country / sub-service), tabs for Pricing, Documents, Timelines, Statuses, Terms, Processing options, Refund config, Protection Plan (New Visa). Reuse existing managers inside tabs; old separate pages redirect into the hub. Keep the sidebar short.
2. Sub-service master and Processing Type master (per service: Normal / Express / Urgent labels, active), used by pricing and forms instead of hard-coded arrays.
3. Country flag auto-filled from ISO code with manual override.
4. Pricing history: a PricingRuleHistory row on every create/update (old values, new values, user, time) with a history view. Same for vendor rates.
5. Vendor service-wise rates: VendorService gets cost, rate and validity fields editable in Admin.
6. Admin Quotation Dashboard: filter by country, service, sub-service, visa type, processing type, active, effective and expiry date.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P23 admin part 1".

STATUS: DONE — commit 5f3a332 (2026-09-30). 1) /admin/service-configuration hub: pick service (+ country where relevant) with tabs Pricing, Documents, Timelines, Statuses, Terms, Processing options, Sub-services, Refund config (+ New Visa Countries / Protection Plan, Return Ticket Destinations, OTB Prices / OTB Rules), existing managers reused with optional service/country props; 12 old pages redirect into it; sidebar shortened to one item + Pricing Dashboard. 2) SubService and ProcessingTypeOption masters (Admin CRUD, public /api/processing-types); New Visa + OTB forms, summaries, CRM labels, manual lead form and WhatsApp bot now read labels from the master (codes stay normal/urgent; seeded Normal/Express and Normal/Urgent); intake routes reject a disabled code. 3) Country flag = emoji from ISO code (incl. 3-letter aliases) with Admin override (emoji or image URL), shown in Admin and destination selects. 4) PricingRuleHistory on every create/update (old→new, user) + History panel; pricing rules gain sub-service, visa type and master processing type with server-side reference checks. 5) VendorService cost/rate/valid from/until editable per service in Admin with VendorRateHistory; vendor edit no longer deletes/recreates service rows (rates preserved); rates never leave /api/admin. 6) /admin/pricing-dashboard: filters (country, service, sub-service, visa type, processing, active, status, effective date, expiring within N days), summary counts, paginated table with margin (admin). Migration 20260930180000_admin_part1 local only. 16/16 scripted checks passed (dashboard queries made sequential after a local-DB crash).










TASK P24: Admin gaps part 2.

1. Payment Gateway settings screen: test/live mode display, masked key status, default payment-link validity. Secrets stay in env.
2. Coupons: per-coupon max discount. Abandoned-quotation coupon automation (quote expired or unpaid for X hours -> single-use coupon generated and sent), Admin toggle.
3. Assignment rules config and SLA escalation config (escalate to manager/admin after X hours in a status) with an automation job.
4. Confirmation dialog + reason for every Locked Q14 sensitive action: refund payment, change vendor, change price, delete records, bulk reassignment, change document requirements, change GST/tax, change workflow/status config, financial adjustments.
5. Admin Bookings page inside /admin with search and filters (booking id, customer, service, country, staff, vendor, status, payment status, date).
6. Staff "countries handled" field. Admin can trigger a password reset email for another staff member.
7. Audit Log viewer (filters: user, entity, action, date) and Configuration History view.
8. OCR monitor (jobs, success/fail, retry) and Live Activity page (recent leads, payments, bookings, WhatsApp conversations, OCR jobs, auto-refresh).

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P24 admin part 2".

STATUS: DONE - commit eeb2088 (2026-09-30). 1) /admin/payment-gateway: active provider, test/live mode from key prefix, masked key id + set/not-set flags (no secret ever returned), webhook URL, editable default payment-link validity (SystemConfig.defaultPaymentLinkHours, used after the service Timelines value, else 24). 2) Coupon maxDiscount (caps percentage discounts); abandoned-quotation coupon automation (Admin toggle + type/value/max/hours/validity, refuses to enable half-configured) via /api/automation/abandoned-quote-coupons + n8n JSON: one single-use lead-scoped ABANDONED_QUOTATION coupon per lead, sent with the new ABANDONED_QUOTE_COUPON template (migration 20260930200100); lead-scoped coupons can only be redeemed on that lead. 3) /admin/assignment-rules (service, sub-service, role, max open leads, priority) applied by auto-assign together with staff countries handled; /admin/escalations SLA rules + hourly /api/automation/sla-escalation (notifies managers/admins once per stay in a status, SLA_ESCALATED audit). 4) Shared ConfirmActionDialog + required reason (min 5, stored in the audit note) on every Locked Q14 action: refunds (create/status/protection plan), vendor create/edit/rates + booking vendor change, price changes (pricing rules, OTB prices, RT destination rates, quotation price/vendor/coupon edits, protection plan prices), every DELETE route, bulk reassignment, document requirements, GST/tax, service statuses/transitions, extra payments, bank-transfer approval, manual mark-success, expenses. 5) /admin/bookings search + filters (id, customer, service, country, staff, vendor, status, per-service status, payment status, dates). 6) Staff countries handled (multi-select) + Admin "Send password reset" (reuses the staff reset-token flow, rate-limited). 7) /admin/audit-log and /admin/config-history (config audit rows + pricing/vendor rate history). 8) /admin/ocr-monitor (totals, jobs, failures, passport OCR retry) and /admin/live-activity (auto-refresh 30 s, masked numbers). New lib/db-sequential runSequentially() for multi-query admin screens. Migration 20260930200000_admin_part2 local only. 24/24 scripted checks passed.








TASK P25: Finance and MIS reports (Locked Business Rules v2.0 §15). Existing: P&L, Revenue, Refund. Add, each with date / service / country / staff / vendor filters and audited CSV export:

Finance: Vendor Payments / Vendor Cost, Profit & Margin, Profit per Booking, Profit per Service, Monthly Sales, Outstanding Payments, Expenses, Payment / Gateway Charges, Collection, Service-wise Revenue, Daily / Monthly Financial Summary, Financial Adjustment.
MIS: Sales MIS, Revenue MIS, Profit MIS, Operations MIS, Receivable / Collection MIS (with ageing), Vendor MIS.
Management dashboard: Sales -> Revenue -> Cost -> Gross Profit -> Refunds -> Expenses -> Net Profit -> GST liability -> Cash/Bank position.

Vendor cost and margin are admin-only. Group everything under "Reports & Finance" in the sidebar.

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P25 finance mis".

STATUS: DONE - commit e8df9bb (2026-09-30). Shared report framework (src/lib/reports: ReportDefinition registry, filters date/service/country/staff/vendor, one API /api/admin/reports/[key] with JSON or audited row-capped CSV, generic viewer /admin/reports/[key], index /admin/reports). Finance (12): vendor-payments, profit-margin, profit-per-booking, profit-per-service, monthly-sales, outstanding-payments, expenses, gateway-charges, collection, service-revenue, financial-summary (daily <=62 days else monthly), financial-adjustments (extra payments, coupon discounts, manual/bank-transfer approvals with reasons, refunds). MIS (6): sales, revenue, profit, operations, receivables with 0-7/8-15/16-30/31-60/60+ ageing, vendor. Management dashboard /admin/reports/management: Sales -> Revenue -> Cost -> Gross Profit -> Refunds -> Expenses -> Net Profit -> GST liability -> net cash movement, with previous-period deltas and on-page definitions. All finance.manage (Admin only), grouped under "Reports & Finance" in the sidebar. Every report states its date basis in notes (revenue = SUCCESS payments by updatedAt, ex GST/gateway fee, same as the existing P&L). No schema change. 27/27 scripted checks passed.










TASK P26: Go-live readiness (code side only).

1. Scheduler: every automation route callable by Vercel Cron as well as n8n. Add vercel.json crons: quote-expiry every 5 min, payment-followup hourly, document-reminder daily, otb-requirement-check daily 9 IST, lead-followup + flight 7-day follow-up daily, visa-extension-reminder daily, return-ticket auto-complete daily, document-retention weekly, audit-retention weekly. Keep automation key auth.
2. Integrations Health page shows red status and blocks a new "Go-live ready" flag when Razorpay / Resend / WhatsApp / OCR keys are missing, WhatsApp templates lack metaTemplateName, systemAlertEmail is empty, GST > 0, or any master table still has "Sample" / "Test" rows.
3. scripts/cleanup-test-data.ts: dry-run by default, lists test customers/leads/bookings/payments (test name/email patterns, mock_ gateway refs, Sample/Test master rows); deletes only with --confirm plus a typed confirmation. Do NOT run it yourself.
4. CSV import with validation preview for Airlines, Borders, Vendors, PricingRules, DocumentRequirements (Airports import already exists).
5. Tests: add vitest with a minimal suite for the reference ID generator (sequence, month rollover, concurrency), pricing totals, refund rules, OTB processing rules, quote payability, status transitions. Add an npm test script and a GitHub Actions workflow running tsc, lint and tests on push.
6. Rewrite README.md for the real project and update CLAUDE.md to match current code (no password literals).

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. Vendor cost and margin stay internal. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P26 go live readiness".

STATUS: DONE - commit 72db1ca (2026-09-30). 1) All 12 automation routes accept GET (Vercel Cron) as well as POST (n8n); auth accepts AUTOMATION_API_KEY or CRON_SECRET (constant-time, safe-closed); vercel.json schedules all 12 (UTC; IST table in AUTOMATION_WORKFLOWS.md; sub-daily jobs need Vercel Pro or n8n/VPS cron). 2) Integrations Health (Admin -> Automation): red/green checks with fix hints for Razorpay, Resend, WhatsApp keys, Meta template names, Anthropic/OCR key, automation key, system alert email, GST kept at 0% (locked rule until GSTIN; >0 blocks), Sample/Test master rows per table; "Go-live ready" flag (SystemConfig.goLiveReady, migration 20260930220000_go_live_flag) can only be set when every check is green, reason required, audited. 3) scripts/cleanup-test-data.ts - dry-run by default; deletes only with --confirm + typed "DELETE TEST DATA", refuses production without an extra flag (NOT run). 4) CSV import with validation preview + commit for Airlines, Borders, Vendors, Pricing Rules, Document Requirements (/api/admin/import/[entity], reason required for the sensitive ones, pricing history written). 5) vitest 4.1.11 (5.x needs @types/node 22), 68 tests over reference IDs, pricing/coupons, refund rules, OTB + working calendar, quote payability, status transitions; npm test; .github/workflows/ci.yml runs tsc, lint and tests. 6) README.md rewritten; CLAUDE.md updated to the current code (no secrets). Runtime checks 8/8.




TASK P27: Client decision: ALL documents auto-delete after the Admin-selected number of days. No document type is exempt.

1. src/app/api/automation/document-retention/route.ts: remove the passport/visa exemption (isRetainedType). Delete the stored file of every document type, including passport, visa, tickets, bank slips and delivered output PDFs (visa/ticket/package). Remove the duplicate isRetainedType copy in src/lib/documents/reuse.ts and any other place that relies on it.
2. Scope:
   a. Documents on bookings in a terminal status (COMPLETED, CANCELLED, REFUNDED, or a service status marked terminal): delete when the booking's terminal date is older than documentRetentionDays.
   b. Documents on leads that never became a booking (intake uploads for abandoned or lost leads): delete when the lead's last update is older than documentRetentionDays.
   c. Never delete documents of an active (non-terminal) lead or booking.
3. Delete the physical file (disk or FileBlob row), set fileUrl to null and purgedAt, keep the Document row and write an audit entry, so staff can see "File deleted after retention period" instead of a broken link.
4. Admin → System Config: keep documentRetentionDays (default 90) with help text "All documents are deleted this many days after the case is closed." Changing it asks for confirmation.
5. Document reuse (returning passenger "Use Existing"): only offer files that still exist; hide purged ones. Remove the separate hard-coded REUSE_WINDOW_DAYS = 90 and use documentRetentionDays.
6. Customer /account and staff screens show "Deleted after retention period" for purged files.
7. Run mode: real delete by default when the job is called with the automation key; add ?dryRun=true to preview counts. The job must be scheduled daily (it will run via cron on the VPS).

RULES: Read CLAUDE.md first. Never run prisma migrate reset or db push, never drop or truncate tables, never delete existing data by hand; do NOT run the retention job against any database yourself, only test it with dryRun on local data. Schema changes only via prisma migrate dev --create-only, review the SQL, apply locally. Never connect to or modify the production DB. No unrelated refactors. When done run npx tsc --noEmit, npm run lint, npm run build (all must pass), list every changed file, then commit "P27 all documents auto-delete".

STATUS: DONE - commit 918852b (2026-09-30). Passport/visa exemption removed everywhere (retention route + src/lib/documents/reuse.ts). New src/lib/documents/retention.ts: (a) closed bookings (COMPLETED/CANCELLED/REFUNDED or terminal service status) purge every document file + bank-transfer slip once the closing date (latest status-change audit, else updatedAt) is older than documentRetentionDays; (b) intake uploads of never-booked leads purge once every referencing lead is idle past the window; (c) active leads/bookings never touched. File deleted, Document row kept with fileUrl null + purgedAt, audit row per purge (bank slip: Payment.bankSlipUrl cleared + audit). Job deletes by default, ?dryRun=true previews counts and ids; scheduled daily (vercel.json 21:30 UTC = 03:00 IST, n8n JSON daily). Reuse window = documentRetentionDays (REUSE_WINDOW_DAYS removed), purged files never offered. "Deleted after retention period" on /account and staff screens. Changing retention days needs confirmation + reason (API enforces). Verified with dry runs only (10/10 fixture checks); the real purge was never run.

DEPLOYED: P15-P27 live on 2026-09-30 (commit 63cf92f, Vercel deployment tripnexio-dy5gpk3xs, production). Prod backup E:\TripNexio-backups\prod-backup-2026-09-30T11-42-10-577Z.json.gz (65 tables, 2000 rows) taken first; 11 migrations 20260929140000..20260930220000 applied with prisma migrate deploy. CRON_SECRET added to Vercel production. Project is on Vercel Hobby, so vercel.json runs every job once a day; quote-expiry (5 min) and the 4 hourly jobs must also run from n8n/VPS cron. Live smoke test: public pages, new public APIs and staff/admin auth gates OK.
