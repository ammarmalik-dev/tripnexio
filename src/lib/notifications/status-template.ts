import type { ServiceType, StatusScope } from "../../generated/prisma/enums";
import { db } from "../db";
import { siteConfig } from "../site-config";
import { getSiteContact } from "../settings/system-config";
import { leadReference } from "../leads/reference";
import { formatBusinessDateTime } from "../format-business-time";
import { requestedRouteFromDetails } from "../quotations/flight-quote";
import { documentDisplayName, documentsByPassengerSummary } from "../documents/review-round";
import { bookingDocumentsWhere, leadDocumentsWhere } from "../documents/document-lead";
import { paymentTotal } from "../payments/totals";
import { toWhatsAppId } from "../whatsapp/phone";
import { notifyCustomer } from "./notify";
import type { EmailAttachment } from "../email/sender";
import { readStoredFile, FILE_URL_PREFIX } from "../storage/local-file-storage";

/**
 * Client doc 2026-10-20 — every status of the client's lists sends its own email + WhatsApp template
 * (src/lib/service-status/template-catalog.json, Admin-editable). This builds the variables those
 * templates use (the client's names: {{customer_name}}, {{booking_id}}, {{required_documents}}…) from
 * the booking / lead itself, so a message never shows an unfilled placeholder, and sends it with the
 * template's button and — for Paid / Visa Approved / Package / Ticket — the PDF attached.
 */

/** Every variable a status template may use (the client's names, plus the shared email shell's). */
export const STATUS_VARIABLE_NAMES = [
  "customer_name",
  "application_id",
  "lead_id",
  "booking_id",
  "country_name",
  "visa_type",
  "visa_duration",
  "visa_change_method",
  "passenger_count",
  "passenger_names",
  "passenger_name",
  "travel_date",
  "origin",
  "destination",
  "requested_origin",
  "requested_destination",
  "airline_flight_number",
  "pnr",
  "baggage",
  "itinerary_summary",
  "quotation_id",
  "currency",
  "total_amount",
  "quoted_amount",
  "amount_due",
  "quote_expiry_time",
  "payment_deadline",
  "extension_fee",
  "verified_fine_amount",
  "other_charges",
  "package_summary",
  "eligibility_and_validity",
  "package_reference",
  "submission_date",
  "amount_paid",
  "paid_amount",
  "payment_amount",
  "payment_reference",
  "approved_passenger_names",
  "approved_passengers",
  "rejected_passenger_names",
  "cancelled_passenger_names",
  "cancelled_passengers",
  "cancelled_passengers_or_items",
  "cancelled_scope",
  "cancellation_scope",
  "cancellation_passenger_names",
  "active_passenger_names",
  "remaining_passengers_or_items",
  "remaining_scope",
  "other_passenger_outcomes",
  "pending_or_not_approved_passengers",
  "pending_or_rejected_passengers",
  "refund_passenger_names",
  "affected_passenger_names",
  "passengers_requiring_documents",
  "required_documents",
  "required_document_list",
  "document_issue_list",
  "missing_documents_list",
  "missing_or_incorrect_documents",
  "additional_document_list",
  "requested_items",
  "submitted_document_list",
  "document_name",
  "refund_id",
  "refund_reference",
  "refund_amount",
  "confirmed_refund_amount",
  "refund_status",
  "estimated_refund",
  "cancellation_charges",
  "cancellation_quote_expiry",
  "verified_reason",
  "rejection_reason",
  "customer_safe_rejection_reason",
  "verified_customer_safe_reason",
  "verified_customer_safe_reason_or_authority_provided_no_reason",
  "customer_safe_reason",
  "hold_reason",
  "customer_safe_hold_reason",
  "hold_next_action",
  "next_step",
  "additional_document_reason",
  "customer_safe_request_reason",
  "requesting_authority",
  "due_date",
  "verified_cancellation_details",
  "secure_link",
  "portal_link",
  "track_status_url",
  "secure_booking_link",
  "secure_upload_link",
  "payment_link",
  "secure_payment_link",
  "quote_link",
  "secure_quotation_link",
  "new_quote_link",
  "alternative_link",
  "alternative_summary",
  "alternative_origin",
  "alternative_destination",
  "alternative_itinerary",
  "alternative_amount",
  "fare_difference",
  "additional_amount",
  "cancellation_quote_link",
  "visa_download_url",
  "approved_visa_url",
  "approved_visa_links",
  "ticket_link",
  "ticket_download_link",
  "secure_package_link",
  "secure_visa_link",
  "secure_refund_link",
  "support_link",
  "support_email",
  "customerName",
  "bookingId",
  "leadReference",
  "status",
] as const;
export type StatusVariableName = (typeof STATUS_VARIABLE_NAMES)[number];

const OUTCOME_LABEL = { APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled" } as const;
const PENDING_DOC = new Set(["REQUIRED", "MISSING", "REJECTED"]);
const VISA_OUTPUTS = ["VISA_PDF", "EXTENDED_VISA_PDF"];
const TICKET_OUTPUTS = ["TICKET_PDF", "RESERVATION_PDF"];

/** Values staff enter when moving a record (Change Status): the customer-safe reason, next step, charges… */
export interface StatusInputs {
  reason?: string;
  nextStep?: string;
  authority?: string;
  dueDate?: string;
  cancellationCharges?: string;
  estimatedRefund?: string;
  cancellationQuoteExpiry?: string;
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const joinNames = (names: string[]) => names.filter(Boolean).join(", ");

function detailString(details: unknown, key: string): string {
  if (!details || typeof details !== "object") return "";
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function formatDate(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
}

const VISA_CHANGE_METHOD: Record<string, string> = { AIRPORT_TO_AIRPORT: "Airport-to-Airport", BORDER_EXIT: "Border Exit" };

/**
 * Every variable the client's templates use, for one lead or booking. `inputs` are what staff typed when
 * changing the status; a customer-safe reason falls back to the client's "no detailed reason" wording.
 */
export async function buildStatusVariables(scope: StatusScope, entityId: string, inputs: StatusInputs = {}, statusLabel = ""): Promise<Record<string, string> | null> {
  const booking =
    scope === "BOOKING"
      ? await db.booking.findUnique({
          where: { id: entityId },
          include: {
            passengers: { include: { passenger: { select: { id: true, fullName: true } } } },
            payments: { where: { status: "SUCCESS" }, orderBy: { updatedAt: "desc" } },
          },
        })
      : null;
  const leadId = booking?.leadId ?? (scope === "LEAD" ? entityId : null);
  if (!leadId) return null;
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      customer: true,
      country: { select: { name: true } },
      bookings: { orderBy: { createdAt: "desc" }, select: { id: true, customerToken: true, status: true } },
    },
  });
  if (!lead) return null;

  const contact = await getSiteContact();
  const site = siteConfig.url.replace(/\/$/, "");
  const reference = leadReference(lead);
  const pendingBooking = booking ?? lead.bookings.find((row) => row.customerToken) ?? null;
  const token = booking?.customerToken ?? pendingBooking?.customerToken ?? null;
  // Client 2026-10-25 — a button must open the customer's own page (status, documents, payment), never the bare
  // Track page: the booking's page once there is one, else the lead's own quote page, else Track with the reference filled in.
  const leadPage = lead.customerToken ? `${site}/quote/${lead.customerToken}` : null;
  const securePage = token ? `${site}/pay/${token}` : (leadPage ?? `${site}/track?ref=${encodeURIComponent(reference)}`);
  const quotePage = leadPage ?? securePage;

  // Passengers and their own results (client doc 2026-10-15, I4).
  const bookingPassengers = booking?.passengers ?? [];
  const leadPassengerNames = bookingPassengers.length
    ? []
    : (
        await db.passenger.findMany({
          where: { id: { in: ((lead.details as { passengerIds?: string[] } | null)?.passengerIds ?? []).filter((id) => typeof id === "string") } },
          select: { fullName: true },
        })
      ).map((row) => row.fullName);
  const allNames = bookingPassengers.length ? bookingPassengers.map((row) => row.passenger.fullName) : leadPassengerNames;
  const byOutcome = (outcome: keyof typeof OUTCOME_LABEL) => bookingPassengers.filter((row) => row.outcome === outcome).map((row) => row.passenger.fullName);
  const approved = byOutcome("APPROVED");
  const rejected = byOutcome("REJECTED");
  const cancelled = byOutcome("CANCELLED");
  const active = bookingPassengers.filter((row) => row.outcome !== "CANCELLED" && row.outcome !== "REJECTED").map((row) => row.passenger.fullName);
  const others = bookingPassengers
    .filter((row) => row.outcome !== "APPROVED")
    .map((row) => `${row.passenger.fullName} — ${row.outcome ? OUTCOME_LABEL[row.outcome] : "In progress"}`);
  const label = statusLabel.toLowerCase();
  const isFullApproval = /approved/.test(label) && !/partial/.test(label);
  const isRejection = /reject|not accepted|not eligible/.test(label);
  const isCancellation = /cancel/.test(label) && !/partial/.test(label);

  // Documents: what is still missing / rejected (per passenger), and what came in most recently.
  const documents = await db.document.findMany({
    where: booking ? bookingDocumentsWhere(booking) : leadDocumentsWhere(lead.id),
    include: { passenger: { select: { fullName: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const pendingDocs = documents.filter((doc) => PENDING_DOC.has(doc.status) && !doc.purgedAt);
  const requiredList = documentsByPassengerSummary(
    pendingDocs.map((doc) => ({
      passengerName: doc.passenger?.fullName,
      label: `${documentDisplayName(doc.type)}${doc.status === "REJECTED" ? ` (rejected${doc.rejectionReason ? `: ${doc.rejectionReason}` : ""})` : doc.status === "MISSING" ? " (missing)" : ""}`,
    }))
  );
  const received = documents.filter((doc) => doc.status === "RECEIVED");
  const receivedList = documentsByPassengerSummary(received.map((doc) => ({ passengerName: doc.passenger?.fullName, label: documentDisplayName(doc.type) })));
  const docPassengers = [...new Set(pendingDocs.map((doc) => doc.passenger?.fullName).filter((name): name is string => !!name))];
  const requestReason = pendingDocs.find((doc) => doc.requestReason)?.requestReason ?? "";
  const outputLink = (types: string[]) => {
    const files = documents.filter((doc) => types.includes(doc.type) && doc.fileUrl && !doc.purgedAt);
    if (files.length === 1 && token) return `${site}${files[0].fileUrl}?token=${token}`;
    return files.length > 0 ? securePage : "";
  };

  // Quotation (selected, else the latest one sent).
  const quotation = await db.quotation.findFirst({
    where: { leadId: lead.id, isDraft: false },
    orderBy: [{ isSelected: "desc" }, { updatedAt: "desc" }],
  });
  const quoteTotal = quotation ? Number(quotation.sellingPrice) - Number(quotation.couponDiscount ?? 0) : null;
  const quoteExpiry = quotation?.validityExpiresAt ? await formatBusinessDateTime(quotation.validityExpiresAt) : "";
  const route = lead.serviceType === "FLIGHT_SPECIAL_FARE" ? (quotation?.route ?? requestedRouteFromDetails(lead.details) ?? "") : "";
  const [origin, destination] = route.includes("→") ? route.split("→").map((part) => part.trim()) : ["", ""];
  const flight = quotation ? [quotation.airline, quotation.flightNumber].filter(Boolean).join(" ") : "";
  const flightTime = quotation?.flightDateTime ? await formatBusinessDateTime(quotation.flightDateTime) : "";

  // Payment + refund.
  const payment = booking?.payments[0] ?? null;
  const refund = booking
    ? await db.refund.findFirst({ where: { payment: { bookingId: booking.id }, status: { not: "REJECTED" } }, orderBy: { updatedAt: "desc" } })
    : null;
  const refundAmount = refund ? money(Number(refund.refundAmount)) : "";
  const refundRef = refund ? (refund.gatewayRefundId ?? `RF-${refund.id.slice(-8).toUpperCase()}`) : "";

  // Special Fare alternative (booking.alternativeOffer — read here directly to keep this module free of the SF module).
  const offer = (booking?.alternativeOffer ?? null) as { route?: string; airline?: string; flightNumber?: string; flightDateTime?: string; sellingPrice?: number; difference?: number } | null;
  const [altOrigin, altDestination] = offer?.route?.includes("→") ? offer.route.split("→").map((part) => part.trim()) : [offer?.route ?? "", ""];
  const altItinerary = offer ? [offer.route, [offer.airline, offer.flightNumber].filter(Boolean).join(" "), offer.flightDateTime].filter(Boolean).join(" · ") : "";

  const authorityReason = inputs.reason?.trim() || bookingPassengers.find((row) => row.outcome === "REJECTED" && row.outcomeNote)?.outcomeNote || "";
  const noReason = lead.serviceType === "OTB" ? "The airline did not provide a detailed reason." : "No detailed reason was provided by the authority.";

  const vars: Record<StatusVariableName, string> = {
    customer_name: lead.customer.name,
    application_id: reference,
    lead_id: reference,
    booking_id: booking?.bookingId ?? reference,
    country_name: lead.country?.name ?? detailString(lead.details, "destinationCountry"),
    visa_type: detailString(lead.details, "visaType"),
    visa_duration: detailString(lead.details, "visaOption"),
    visa_change_method: VISA_CHANGE_METHOD[detailString(lead.details, "changeType")] ?? "",
    passenger_count: String(allNames.length || lead.paxCount || ""),
    passenger_names: joinNames(allNames),
    passenger_name: joinNames(allNames),
    travel_date: formatDate(lead.travelDate),
    origin,
    destination,
    requested_origin: origin,
    requested_destination: destination,
    airline_flight_number: flight || "as per your ticket",
    pnr: booking?.pnr ?? "",
    baggage: booking?.ticketBaggage ?? quotation?.baggageAllowance ?? "",
    itinerary_summary: [route, flight, flightTime].filter(Boolean).join(" · "),
    quotation_id: quotation ? `Q-${quotation.id.slice(-6).toUpperCase()}` : "",
    currency: "",
    total_amount: money(quoteTotal),
    quoted_amount: money(quoteTotal),
    amount_due: money(quoteTotal),
    quote_expiry_time: quoteExpiry,
    payment_deadline: quoteExpiry,
    extension_fee: quotation ? money(Number(quotation.feeAmount ?? quotation.sellingPrice) ) : "",
    verified_fine_amount: quotation?.fineOrCharges != null ? money(Number(quotation.fineOrCharges)) : "",
    other_charges: quotation?.otherCharges != null ? money(Number(quotation.otherCharges)) : "",
    package_summary: quotation?.inclusions?.length ? quotation.inclusions.join(", ") : "",
    eligibility_and_validity: quoteExpiry ? `Valid until ${quoteExpiry}` : "",
    package_reference: booking?.bookingId ?? reference,
    submission_date: formatDate(new Date()),
    amount_paid: payment ? money(paymentTotal(payment)) : "",
    paid_amount: payment ? money(paymentTotal(payment)) : "",
    payment_amount: payment ? money(paymentTotal(payment)) : "",
    payment_reference: payment?.gatewayRef ?? payment?.invoiceNumber ?? "",
    approved_passenger_names: joinNames(approved.length ? approved : isFullApproval ? active : []),
    approved_passengers: joinNames(approved.length ? approved : isFullApproval ? active : []),
    rejected_passenger_names: joinNames(rejected.length ? rejected : isRejection ? allNames : []),
    cancelled_passenger_names: joinNames(cancelled.length ? cancelled : isCancellation ? allNames : []),
    cancelled_passengers: joinNames(cancelled.length ? cancelled : allNames),
    cancelled_passengers_or_items: joinNames(cancelled.length ? cancelled : allNames),
    cancelled_scope: joinNames(cancelled.length ? cancelled : allNames),
    cancellation_scope: joinNames(cancelled.length ? cancelled : allNames),
    cancellation_passenger_names: joinNames(cancelled.length ? cancelled : allNames),
    active_passenger_names: joinNames(active),
    remaining_passengers_or_items: joinNames(active),
    remaining_scope: joinNames(active),
    other_passenger_outcomes: others.join("; "),
    pending_or_not_approved_passengers: others.join("; "),
    pending_or_rejected_passengers: others.join("; "),
    refund_passenger_names: joinNames([...cancelled, ...rejected]),
    affected_passenger_names: joinNames(docPassengers.length ? docPassengers : allNames),
    passengers_requiring_documents: joinNames(docPassengers.length ? docPassengers : allNames),
    required_documents: requiredList || receivedList,
    required_document_list: requiredList,
    document_issue_list: requiredList,
    missing_documents_list: requiredList,
    missing_or_incorrect_documents: requiredList,
    additional_document_list: requiredList,
    requested_items: requiredList,
    submitted_document_list: receivedList,
    document_name: receivedList,
    refund_id: refundRef,
    refund_reference: refundRef,
    refund_amount: refundAmount,
    confirmed_refund_amount: refundAmount,
    refund_status: refund ? refund.status.charAt(0) + refund.status.slice(1).toLowerCase() : "",
    estimated_refund: inputs.estimatedRefund?.trim() || refundAmount,
    cancellation_charges: inputs.cancellationCharges?.trim() ?? "",
    cancellation_quote_expiry: inputs.cancellationQuoteExpiry?.trim() ?? "",
    // Customer-safe wording staff entered (never the internal note), with the client's fallbacks.
    verified_reason: authorityReason || noReason,
    rejection_reason: authorityReason || noReason,
    customer_safe_rejection_reason: authorityReason || noReason,
    verified_customer_safe_reason: authorityReason || noReason,
    verified_customer_safe_reason_or_authority_provided_no_reason: authorityReason || noReason,
    customer_safe_reason: inputs.reason?.trim() ?? "",
    hold_reason: inputs.reason?.trim() ?? "",
    customer_safe_hold_reason: inputs.reason?.trim() ?? "",
    hold_next_action: inputs.nextStep?.trim() ?? "",
    next_step: inputs.nextStep?.trim() ?? "",
    additional_document_reason: inputs.reason?.trim() || requestReason,
    customer_safe_request_reason: inputs.reason?.trim() || requestReason,
    requesting_authority: inputs.authority?.trim() || "embassy/immigration authority",
    due_date: inputs.dueDate?.trim() ?? "",
    verified_cancellation_details: inputs.reason?.trim() ?? "",
    // Secure links: the booking's own token page (status, documents, payment), never a staff link.
    secure_link: securePage,
    portal_link: securePage,
    track_status_url: securePage,
    secure_booking_link: securePage,
    secure_upload_link: securePage,
    payment_link: pendingBooking && token && pendingBooking.status === "PENDING" ? securePage : quotePage,
    secure_payment_link: pendingBooking && token && pendingBooking.status === "PENDING" ? securePage : quotePage,
    quote_link: quotePage,
    secure_quotation_link: quotePage,
    new_quote_link: quotePage,
    alternative_link: securePage,
    alternative_summary: altItinerary ? `${altItinerary}${offer?.sellingPrice ? ` — ${money(offer.sellingPrice)}` : ""}` : "",
    alternative_origin: altOrigin,
    alternative_destination: altDestination,
    alternative_itinerary: altItinerary,
    alternative_amount: offer?.sellingPrice ? money(offer.sellingPrice) : "",
    fare_difference: offer?.difference ? money(Math.abs(offer.difference)) : "",
    additional_amount: offer?.difference && offer.difference > 0 ? money(offer.difference) : "",
    cancellation_quote_link: securePage,
    visa_download_url: outputLink(VISA_OUTPUTS) || securePage,
    approved_visa_url: outputLink(VISA_OUTPUTS) || securePage,
    approved_visa_links: outputLink(VISA_OUTPUTS) || securePage,
    ticket_link: outputLink(TICKET_OUTPUTS) || securePage,
    ticket_download_link: outputLink(TICKET_OUTPUTS) || securePage,
    secure_package_link: outputLink(["PACKAGE_PDF"]) || securePage,
    secure_visa_link: outputLink(VISA_OUTPUTS) || securePage,
    secure_refund_link: securePage,
    support_link: `${site}/contact`,
    support_email: contact.email,
    // Names the shared email shell (Booking ID card, status pill) reads.
    customerName: lead.customer.name,
    bookingId: booking?.bookingId ?? "",
    leadReference: reference,
    status: statusLabel,
  };
  return vars;
}

/** The delivered files to attach to an approval / package / ticket email (only ones that are still stored). */
async function outputAttachments(bookingId: string, types: string[]): Promise<EmailAttachment[]> {
  const docs = await db.document.findMany({
    where: { bookingId, type: { in: types }, fileUrl: { not: null }, purgedAt: null },
    include: { passenger: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" },
  });
  const attachments: EmailAttachment[] = [];
  let size = 0;
  const seen = new Set<string>();
  for (const doc of docs) {
    if (!doc.fileUrl?.startsWith(FILE_URL_PREFIX) || seen.has(doc.fileUrl)) continue;
    seen.add(doc.fileUrl); // one file can cover several passengers
    const file = await readStoredFile(doc.fileUrl.slice(FILE_URL_PREFIX.length)).catch(() => null);
    if (!file) continue;
    size += file.data.length;
    if (size > 15 * 1024 * 1024) break; // stay inside the mail provider's limit — the button link still works
    const ext = file.mimeType === "application/pdf" ? "pdf" : file.mimeType === "image/png" ? "png" : "jpg";
    const who = doc.passenger?.fullName ? `-${doc.passenger.fullName.replace(/[^\w]+/g, "-")}` : "";
    attachments.push({ filename: `${documentDisplayName(doc.type).replace(/\s+/g, "-")}${who}.${ext}`, content: file.data });
  }
  return attachments;
}

/** Which delivered documents a status template carries, by its event code. */
function attachmentTypesFor(event: string): string[] {
  if (/VISA_APPROVED|PARTIAL_APPROVAL|EXT_15|EXT_14/.test(event)) return VISA_OUTPUTS;
  if (/PACKAGE_GENERATED/.test(event)) return ["PACKAGE_PDF"];
  if (/TICKET_ISSUED|^SF_15$/.test(event)) return TICKET_OUTPUTS;
  return [];
}

/** True when the service runs on the client's per-status templates (any status of it names a notification). */
export async function usesStatusTemplates(serviceType: ServiceType): Promise<boolean> {
  const count = await db.serviceStatus.count({ where: { serviceType, active: true, notificationEvent: { not: null } } });
  return count > 0;
}

/**
 * Sends one of the client's status templates (email + WhatsApp) for a lead or booking. Never throws;
 * every send is audited by the channel senders. `attachments` adds files (e.g. the invoice on Paid).
 */
export async function sendStatusTemplate(input: {
  event: string;
  scope: StatusScope;
  entityId: string;
  statusLabel?: string;
  inputs?: StatusInputs;
  attachments?: EmailAttachment[];
  extraVariables?: Record<string, string>;
  /** The WhatsApp bot's own reply already told the customer (client doc 2026-10-15) — email only. */
  skipWhatsApp?: boolean;
}): Promise<void> {
  try {
    const variables = await buildStatusVariables(input.scope, input.entityId, input.inputs, input.statusLabel ?? "");
    if (!variables) return;
    const customer =
      input.scope === "LEAD"
        ? (await db.lead.findUnique({ where: { id: input.entityId }, select: { customer: true } }))?.customer
        : (await db.booking.findUnique({ where: { id: input.entityId }, select: { customer: true } }))?.customer;
    if (!customer) return;
    const types = input.scope === "BOOKING" ? attachmentTypesFor(input.event) : [];
    const files = types.length ? await outputAttachments(input.entityId, types) : [];
    await notifyCustomer({
      event: input.event,
      emailTo: customer.email,
      whatsappTo: toWhatsAppId(customer.mobile),
      smsTo: null,
      variables: { ...variables, ...input.extraVariables },
      auditTarget: { entityType: input.scope === "LEAD" ? "Lead" : "Booking", entityId: input.entityId },
      emailAttachments: [...(input.attachments ?? []), ...files],
      skipWhatsApp: input.skipWhatsApp,
    });
  } catch (error) {
    console.error("[status-template] send failed", error instanceof Error ? error.message : "unknown");
  }
}

/** The notification event of the status tagged `systemEvent` in a service's list (e.g. its "Refund Pending" template), or null. */
export async function statusTemplateFor(serviceType: ServiceType, scope: StatusScope, systemEvent: string): Promise<{ event: string; label: string } | null> {
  const status = await db.serviceStatus.findFirst({
    where: { serviceType, scope, systemEvent, active: true, notificationEvent: { not: null } },
    select: { notificationEvent: true, customerLabel: true, name: true },
  });
  return status?.notificationEvent ? { event: status.notificationEvent, label: status.customerLabel ?? status.name } : null;
}

/**
 * Client doc 2026-10-20 — the message for where a lead / booking is right now (e.g. a new lead's "New"
 * status: request received, complete payment). False when the service doesn't use status templates or
 * the current status sends nothing, so the caller can fall back to its own message.
 */
export async function sendCurrentStatusTemplate(
  scope: StatusScope,
  entityId: string,
  options: { attachments?: EmailAttachment[]; skipWhatsApp?: boolean } = {}
): Promise<boolean> {
  const record =
    scope === "LEAD"
      ? await db.lead.findUnique({ where: { id: entityId }, select: { serviceType: true, serviceStatus: { select: { notificationEvent: true, customerLabel: true, name: true } } } })
      : await db.booking.findUnique({
          where: { id: entityId },
          select: { lead: { select: { serviceType: true } }, serviceStatus: { select: { notificationEvent: true, customerLabel: true, name: true } } },
        });
  if (!record) return false;
  const serviceType = "serviceType" in record ? record.serviceType : record.lead.serviceType;
  if (!(await usesStatusTemplates(serviceType))) return false;
  const status = record.serviceStatus;
  if (status?.notificationEvent) {
    await sendStatusTemplate({
      event: status.notificationEvent,
      scope,
      entityId,
      statusLabel: status.customerLabel ?? status.name,
      attachments: options.attachments,
      skipWhatsApp: options.skipWhatsApp,
    });
  }
  return true;
}

/**
 * Client doc 2026-10-20 (K5) — one documents message for a booking on the client's templates: the
 * "Documents Required" list (rejected / missing, per passenger) or "Documents Pending" (to upload). At an
 * additional-documents stage the current status's own message is used. False when the service isn't on
 * status templates (the caller sends its own message).
 */
export async function sendDocumentsStatusTemplate(bookingId: string, kind: "REQUESTED" | "REJECTED"): Promise<boolean> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { lead: { select: { serviceType: true } }, serviceStatus: { select: { systemEvent: true, notificationEvent: true, customerLabel: true, name: true } } },
  });
  if (!booking || !(await usesStatusTemplates(booking.lead.serviceType))) return false;
  const current = booking.serviceStatus;
  if (current?.notificationEvent && (current.systemEvent === "EMBASSY_ADDITIONAL_DOCS" || (kind === "REJECTED" && current.systemEvent === "DOCUMENTS_REJECTED") || (kind === "REQUESTED" && current.systemEvent === "DOCUMENTS_REQUESTED"))) {
    await sendStatusTemplate({ event: current.notificationEvent, scope: "BOOKING", entityId: bookingId, statusLabel: current.customerLabel ?? current.name });
    return true;
  }
  const serviceType = booking.lead.serviceType;
  const template =
    (kind === "REJECTED" ? await statusTemplateFor(serviceType, "BOOKING", "DOCUMENTS_REJECTED") : null) ?? (await statusTemplateFor(serviceType, "BOOKING", "DOCUMENTS_REQUESTED"));
  if (template) await sendStatusTemplate({ event: template.event, scope: "BOOKING", entityId: bookingId, statusLabel: template.label });
  return true;
}

/**
 * Client doc 2026-10-20 — the unpaid-payment reminder on the client's templates: the lead moves to its
 * "Payment Pending" status (Visa Change / Extension / Special Fare) and that message goes out; a new
 * request still on "New" (New Visa / OTB / Return Ticket) gets its "complete payment" message again.
 * False when the service isn't on status templates.
 */
export async function sendPaymentReminderTemplate(leadId: string): Promise<boolean> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { serviceType: true, serviceStatusId: true, serviceStatus: { select: { displayOrder: true, notificationEvent: true, mapsToLeadStatus: true } } },
  });
  if (!lead || !(await usesStatusTemplates(lead.serviceType))) return false;
  const pendingStatus = await db.serviceStatus.findFirst({
    where: { serviceType: lead.serviceType, scope: "LEAD", active: true, mapsToLeadStatus: "PAYMENT_PENDING", notificationEvent: { not: null } },
    select: { id: true, notificationEvent: true, customerLabel: true, name: true },
  });
  if (pendingStatus?.notificationEvent) {
    if (lead.serviceStatusId !== pendingStatus.id) {
      const { setServiceStatus } = await import("../service-status/engine");
      await db.$transaction((tx) => setServiceStatus(tx, { scope: "LEAD", entityId: leadId, toStatusId: pendingStatus.id, actorLabel: "payment reminder" }));
    }
    await sendStatusTemplate({ event: pendingStatus.notificationEvent, scope: "LEAD", entityId: leadId, statusLabel: pendingStatus.customerLabel ?? pendingStatus.name });
    return true;
  }
  if (lead.serviceStatus?.displayOrder === 0 && lead.serviceStatus.notificationEvent) await sendCurrentStatusTemplate("LEAD", leadId);
  return true;
}

/** Client doc 2026-10-20 — the template variables staff fill in when moving a record (Change Status). */
const STAFF_INPUT_VARIABLES: Record<keyof StatusInputs, string[]> = {
  reason: [
    "rejection_reason",
    "customer_safe_rejection_reason",
    "verified_customer_safe_reason",
    "verified_customer_safe_reason_or_authority_provided_no_reason",
    "verified_reason",
    "customer_safe_reason",
    "hold_reason",
    "customer_safe_hold_reason",
    "additional_document_reason",
    "customer_safe_request_reason",
    "verified_cancellation_details",
  ],
  nextStep: ["hold_next_action", "next_step"],
  authority: ["requesting_authority"],
  dueDate: ["due_date"],
  cancellationCharges: ["cancellation_charges"],
  estimatedRefund: ["estimated_refund"],
  cancellationQuoteExpiry: ["cancellation_quote_expiry"],
};

export type StatusInputKey = keyof StatusInputs;

/** For each notification event, the inputs staff should give (in a stable order) — read from its email + WhatsApp templates. */
export async function statusInputsFor(events: string[]): Promise<Record<string, StatusInputKey[]>> {
  const unique = [...new Set(events.filter(Boolean))];
  if (unique.length === 0) return {};
  const templates = await db.notificationTemplate.findMany({ where: { event: { in: unique }, active: true }, select: { event: true, subject: true, body: true } });
  const result: Record<string, StatusInputKey[]> = {};
  for (const event of unique) {
    const text = templates
      .filter((template) => template.event === event)
      .map((template) => `${template.subject ?? ""}\n${template.body}`)
      .join("\n");
    const used = new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]));
    result[event] = (Object.keys(STAFF_INPUT_VARIABLES) as StatusInputKey[]).filter((key) => STAFF_INPUT_VARIABLES[key].some((name) => used.has(name)));
  }
  return result;
}
