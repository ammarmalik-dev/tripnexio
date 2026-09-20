Phase 2 — Database, APIs, Auth

Prompt 2A (Prisma schema + first migration):



Design and implement the Prisma schema for TripNexio in PostgreSQL, following CLAUDE.md. Use enums for statuses and index foreign keys and status fields. Model:
- Customer (Customer 360): name, mobile, email, createdAt. Has many passengers, leads, bookings.
- Passenger (PAX): linked to Customer. fullName, passportNumber, dob, nationality, adultOrChild, passport doc refs.
- Lead: serviceType enum (NEW_VISA, VISA_EXTENSION, VISA_CHANGE, FLIGHT_SPECIAL_FARE, RETURN_TICKET, OTB), source, status enum, assignedStaffId, createdAt, and a JSON "details" field for service-specific captured fields.
- Quotation: linked to Lead. airline/flight/route/date/time (nullable), vendorId, vendorCost, sellingPrice, margin (computed), validityExpiresAt, isSelected, isExpired, alternativeOf (self-relation for alternative routes).
- Booking: bookingId (formatted like TNX-XX-XXXXXX), linked Lead/Customer, status enum, createdAt.
- Payment: linked Booking. amount, gstAmount, gatewayFee, status enum (PENDING, SUCCESS, FAILED, EXPIRED), gatewayRef, paymentLink, linkExpiresAt.
- Refund: linked Payment. paidAmount, cancellationCharge, gatewayCharge, refundAmount (computed), reason, status.
- Document: linked Passenger/Booking. type, status enum (REQUIRED, MISSING, RECEIVED, VERIFIED, REJECTED), fileUrl.
- AuditTrail: entityType, entityId, action, byUserId, timestamp, note.
- Vendor: name, service, active.
- Masters: Airport (name, code, country, city, gccClassification, activeForA2AEntry, activeForA2AExit, displayOrder, active), Airline (name, code, country, otbRequired, normalPrice, urgentPrice, active), Border (name, side, uaeLocation, destinationLocation, activeForVisaChange, displayOrder, active), DocumentRequirement (nationality, documentName, required, active), Faq (question, answer, category, keywords, displayOrder, published).
- User (staff): name, email, passwordHash, roleId, active.
- Role and Permission: many-to-many for RBAC.
Do NOT seed real domain data (sample rows only, clearly labeled). Create and run the initial migration, confirm the schema compiles, and give me numbered next steps. 



Prompt 2B (authentication):



Implement authentication with Auth.js (NextAuth) in this App Router project, following CLAUDE.md:
- Credentials provider: email + password, bcrypt-hashed, wired to the existing auth screens with zod validation.
- Google OAuth provider (client id/secret from env; add TODO placeholders).
- Guests browse and start requests without an account; protected routes (history, tracking) require login. Add a helper to distinguish guest vs authenticated.
- JWT session strategy. Route-protection middleware for customer-protected pages, and separately for staff/admin routes by role (enforced server-side).
- Rate-limit the login/register endpoints.
- Add a .env.example documenting all auth env variables.
Confirm login, registration, and the Google placeholder work; give me numbered next steps. 



Prompt 2C (lead/customer APIs, wire the frontend flows):

Build REST API routes and wire the existing frontend service flows to create real leads, following CLAUDE.md. Use shared zod schemas for validation and the consistent error shape. For each service flow (OTB, New Visa, Visa Extension, Visa Change, Flight Special Fare, Return Ticket):
- On submit: create or match a Customer (by mobile/email), create Passenger records, create a Lead with serviceType, source, and captured fields in details JSON. Return a confirmation with a lead reference.
- Customer lookup (by mobile/email) so returning customers reuse existing passengers.
- Enforce spec rules: OTB never asks nationality; Visa Change customer never types airport/border names (selected from master options); Visa Extension always captures Entry Date.
Replace the frontend mock submit states with real API calls (with loading/error handling and success toasts). Test creating a lead end to end. Give me numbered next steps.


Prompt 2D (quotation/booking/payment/document APIs, payment stubbed):

Build the REST API layer for quotations, bookings, payments, and documents, following CLAUDE.md. Payment gateway is not integrated yet; stub payment as a manual status update.
- Quotation: create/update/list for a lead, compute margin = sellingPrice - vendorCost, support multiple quotations where selecting one expires the others, support validityExpiresAt and an isExpired check.
- Booking: generate a formatted bookingId on (stubbed) payment success, transition lead/booking status per the spec flows.
- Payment: create a record with amount + gstAmount + gatewayFee, status PENDING, plus a manual "mark success" endpoint.
- Document: create requirements, set statuses, accept an upload URL.
- Write every state change to AuditTrail. Validate all inputs server-side.
Test lead to quotation to stubbed payment to booking. Give me numbered next steps.
Phase 3 — CRM workspace

Prompt 3A (CRM shell + lead list):

Build the staff CRM workspace shell, following CLAUDE.md, auth-protected for staff roles only (server-side):
- CRM layout with sidebar (Leads, Customers, Quotations, Bookings, Payments, Refunds, Documents), glassy but denser and more functional than the marketing site.
- Leads list: table with filters by serviceType and status, search by customer/mobile, sort by created date, status badges, pulling real data. Include loading skeleton, empty state, and error state.
Confirm staff login lands in the CRM and the list renders real data; give me numbered next steps.


Prompt 3B (lead detail + customer 360 + status + timeline):

Build the CRM lead detail page, following CLAUDE.md:
- Customer 360 header: customer info, all their passengers, and their other bookings/services.
- Service-specific captured details for this lead.
- Passenger list with document statuses.
- A status control that transitions the lead through the exact status flow in that service's spec, writing each change to AuditTrail.
- An activity/communications timeline (chronological, from AuditTrail).
- Staff assignment.
Test transitioning a lead through several statuses; give me numbered next steps.

Prompt 3C (quote builder):

Build the CRM quote builder, following CLAUDE.md. Staff-controlled; no live search.
- Flight Special Fare: structured form for airline, flight, route, date, times, baggage, fare type, plus commercial fields (vendor, vendorCost, adult/child/infant fare, sellingPrice, computed margin, quote validity up to a 30-minute max). Support multiple quote options where selecting one expires the others. Support a clearly-labeled alternative route that must NEVER display as the originally requested route. Show a validity countdown; mark expired quotes non-payable.
- Visa services and OTB: simpler quote/pricing form (fee + fine/charges + total) per each spec.
- Customer never sees vendorCost or margin.
Test building and selecting a flight quote with expiry; give me numbered next steps.

Prompt 3D (bookings, payments, refunds, document verification):

Build the remaining CRM operational screens, following CLAUDE.md:
- Bookings: list + detail, with booking status and linked payment status shown separately.
- Payments: status, amount breakdown (base + GST + gateway fee), and the manual mark-success action.
- Refund calculator: staff enters paidAmount, cancellationCharge, gatewayCharge; system computes refundAmount = paidAmount - cancellationCharge - gatewayCharge; records reason and status. Apply the OTB refund rules from its spec (for example the fixed service charge after validation).
- Document verification: staff reviews uploaded documents and sets status; missing documents raise a flag for notification (wired in Phase 5).
Write all actions to AuditTrail; test a refund calculation; give me numbered next steps.
Phase 4 — Admin panel, RBAC, masters

Prompt 4A (RBAC + user management):

Build the Admin RBAC system and user management, following CLAUDE.md:
- Roles and Permissions: create roles, assign granular permissions, assign roles to staff.
- Enforce permissions on both CRM and Admin routes and actions SERVER-SIDE, not just hidden in the UI.
- User management: create/edit/deactivate staff, assign roles.
- The client retains a top-level admin role with full access.
Test that a limited-role user cannot access restricted pages or actions; give me numbered next steps.

Prompt 4B (masters: Airport, Airline, Border):

Build Admin CRUD for the Airport, Airline, and Border masters, following CLAUDE.md. All schema fields, add/edit/enable-disable, display order, and availability flags (A2A entry/exit for airports, visa-change availability for borders, OTB-required plus normal/urgent price for airlines). Include loading/empty/error states and validation.

IMPORTANT per CLAUDE.md: do NOT auto-fill these with a real production list on your own. When we need actual India and GCC airport/airline/border data, PROPOSE the list to me first for review, and seed only after I approve. For now, provide the management UI, manual entry, and a few clearly-labeled sample rows. Give me numbered next steps.

Prompt 4C (masters: document requirements, pricing, vendors, coupons):

Build Admin CRUD for the remaining configuration masters, following CLAUDE.md:
- Document Requirements by nationality: required/optional documents per nationality per service, active/inactive. This drives the customer document checklist.
- Pricing configuration: per service, adult/child, nationality-wise where the spec requires it, plus applicable charges. No hard-coded prices in code.
- Vendors/Sponsors: manage the vendor list used in the quote builder.
- Coupons/Discounts: codes with type, value, validity, usage limits.
All editable without code changes, sample data only, propose real lists before seeding. Give me numbered next steps.

Prompt 4D (FAQ, notification templates, tax/fee config, data export):

Build the remaining Admin controls, following CLAUDE.md:
- FAQ management: create/edit/enable/disable/delete, assign service and category, add keywords, set order, publish/unpublish. This is the single knowledge base used by website, CRM, and later the WhatsApp AI.
- Notification templates: editable WhatsApp and Email templates per event with placeholder variables.
- Tax and fee configuration: GST/tax rate on service fees and gateway fee percentage, both configurable and used in invoice/payment calculations.
- Data export: admin exports core tables (customers, leads, bookings, payments) to CSV.
Test editing a template and exporting a CSV; give me numbered next steps.

Phase 5 — Integrations, automation, deployment

Prompt 5A (payment gateway + GST invoice + gateway fee):

Integrate a real payment gateway, following CLAUDE.md. Use Razorpay (INR/GST friendly) behind a service layer so it can be swapped; keys from env with TODO placeholders (client provides).
- Generate a payment link/order for a booking using amount + GST (from tax config) + gateway fee (from fee config).
- Handle the success/failure webhook to update Payment status and transition the booking, writing to AuditTrail. Verify webhook signatures.
- Enforce that flight payments are allowed only while the quote is valid; block expired quotes.
- Generate a downloadable PDF invoice showing base fare, GST as tax on service fee, gateway fee, and total, with TripNexio details.
Give me numbered next steps.

Prompt 5B (Resend email + templates):

Integrate Resend for transactional email, following CLAUDE.md. API key from env (TODO placeholder; client provides). Wire the spec notification events (request received, quote ready, quote reminder/expiry, payment received, documents required, approval/rejection, etc.) to send using the Admin-managed email templates with variable substitution. Add domain/DNS setup notes to the deployment docs. Test sending one templated email; give me numbered next steps.

Prompt 5C (WhatsApp API + AI/bot journey):

Integrate WhatsApp Cloud API and build the WhatsApp AI/bot journey, following CLAUDE.md. Permanent access token and phone number ID from env (TODO placeholders; client provides).
- Send templated WhatsApp notifications for the same events as email, using the Admin-managed WhatsApp templates.
- Bot journey: a webhook that receives customer messages, detects intent from natural language (for example "mera visa extend karna hai" starts Visa Extension), and routes the customer into the correct service journey, collecting required fields conversationally, then creating a Lead exactly like the website does.
- The AI answers questions ONLY from the Admin FAQ knowledge base. If uncertain, it must NOT invent an answer and should offer human support/handoff.
- Write WHATSAPP_JOURNEY.md explaining entry, intent detection, service routing, FAQ answering, and handoff so the client understands the flow.
Give me numbered next steps.

Prompt 5D (OCR passport/document extraction):

Add OCR for passport and document extraction, following CLAUDE.md, behind a pluggable service layer (provider/key from env, TODO placeholder). On document upload in the customer flow and CRM:
- Extract passport fields (name, passport number, date of birth, nationality where available), ideally via MRZ parsing.
- Autofill extracted values into the passenger record and CRM, shown for staff/customer review and confirmation before saving (never save silently).
Test on a sample passport image and confirm values populate for review; give me numbered next steps.


Prompt 5E (n8n automation + monitoring view):

Set up n8n automation and a monitoring view, following CLAUDE.md:
- n8n workflows for background triggers: quote expiry handling, payment follow-up reminders, OTB requirement checks, and periodic service follow-ups, calling the app's APIs/webhooks securely.
- An admin monitoring view in the app showing background workflow status (last run, success/failure) so staff can see automation health.
Document the workflows; give me numbered next steps.

















Prompt 5F (deployment, backups, docs, testing, training):

Prepare staging and production deployment on a Hostinger VPS using Coolify/Nixpacks, following CLAUDE.md and the client's stated requirements:
- Separate staging and production, separate databases, separate env/secrets.
- Git branch workflow: feature/fix to Pull Request to staging to approval to production. Document it.
- Run Prisma migrations on deploy; no undocumented production schema changes.
- Configure automated database backups AND demonstrate a restore (document the tested restore steps).
- Document rollback via git revert plus restoring the last stable backup.
- DEPLOYMENT.md covering: how to deploy, how to update the database, how to roll back, required environment variables, how to restore a backup.
- Run end-to-end testing across all customer flows, CRM, and Admin, and fix issues found.
- TRAINING.md for the client on operating the CRM and Admin; confirm admin data export works.
Give me numbered next steps.
That's the complete build, Phase 0 through 5, enhanced and consolidated in one place.