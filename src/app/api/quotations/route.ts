import type { NextRequest } from "next/server";
import { createQuotationSchema } from "@/lib/validation/quotation-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { requirePermission } from "@/lib/auth/require-permission";
import { computeSellingPrice, isFlightQuote, assertValidityWithinCap } from "@/lib/quotations/pricing";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { formatLeadReference } from "@/lib/leads/reference";
import { money } from "@/lib/invoices/render-invoice";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("quotations.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) {
    return jsonError(400, "Provide a leadId query parameter.");
  }

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return jsonError(404, "Lead not found.");

  const quotations = await db.quotation.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } });
  const refreshed = await syncExpiredQuotations(quotations);
  return jsonSuccess(refreshed);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("quotations.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createQuotationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const {
    leadId,
    vendorId,
    airline,
    flightNumber,
    route,
    flightDateTime,
    arrivalDateTime,
    baggageAllowance,
    fareType,
    adultFare,
    childFare,
    infantFare,
    feeAmount,
    fineOrCharges,
    vendorCost,
    sellingPrice,
    validityExpiresAt,
    alternativeOfId,
  } = parsed.data;

  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
  if (!lead) return jsonError(404, "Lead not found.");

  const vendor = await db.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor || !vendor.active) {
    return jsonError(400, "Select a valid, active vendor.", { vendorId: ["This vendor isn't available."] });
  }

  const flightQuote = isFlightQuote(lead.serviceType);
  if (flightQuote && sellingPrice == null) {
    return jsonError(400, "Please check the highlighted fields.", { sellingPrice: ["Enter the selling price."] });
  }
  if (!flightQuote && feeAmount == null) {
    return jsonError(400, "Please check the highlighted fields.", { feeAmount: ["Enter the fee amount."] });
  }

  const validityError = assertValidityWithinCap(lead.serviceType, validityExpiresAt);
  if (validityError) {
    return jsonError(400, validityError, { validityExpiresAt: [validityError] });
  }

  if (alternativeOfId) {
    const alternativeOf = await db.quotation.findUnique({ where: { id: alternativeOfId } });
    if (!alternativeOf || alternativeOf.leadId !== leadId) {
      return jsonError(400, "The alternative quotation must belong to the same lead.", {
        alternativeOfId: ["Invalid alternative quotation."],
      });
    }
  }

  // Selling price and margin are always computed/resolved server-side — never trust a client-sent value.
  const resolvedSellingPrice = computeSellingPrice(lead.serviceType, { sellingPrice, feeAmount, fineOrCharges });
  const margin = resolvedSellingPrice - vendorCost;

  const quotation = await db.$transaction(async (tx) => {
    const created = await tx.quotation.create({
      data: {
        leadId,
        vendorId,
        airline,
        flightNumber,
        route,
        flightDateTime: flightDateTime ? new Date(flightDateTime) : undefined,
        arrivalDateTime: arrivalDateTime ? new Date(arrivalDateTime) : undefined,
        baggageAllowance,
        fareType,
        adultFare,
        childFare,
        infantFare,
        feeAmount,
        fineOrCharges,
        vendorCost,
        sellingPrice: resolvedSellingPrice,
        margin,
        validityExpiresAt: validityExpiresAt ? new Date(validityExpiresAt) : undefined,
        alternativeOfId,
      },
    });

    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Quotation created for lead ${leadId} — margin ${margin} (by ${session.name})`,
    });

    return created;
  });

  // "Quote ready" fires on every new quotation for this lead, not only the
  // first one — a lead can reasonably get more than one quote over its
  // lifetime (a revised offer, an alternative route), and there's no signal
  // in the data model for "this is the one to actually notify about" beyond
  // "a quote now exists." Revisit if the client wants this scoped tighter
  // (e.g. only on the first quote, or only once staff explicitly shares it).
  await notifyCustomer({
    event: NOTIFICATION_EVENTS.QUOTE_READY,
    emailTo: lead.customer.email,
    whatsappTo: toWhatsAppId(lead.customer.mobile),
    variables: {
      customerName: lead.customer.name,
      leadReference: formatLeadReference(lead.serviceType, lead.id),
      sellingPrice: money(resolvedSellingPrice),
      quoteValidUntil: validityExpiresAt
        ? new Date(validityExpiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : "no expiry set",
    },
    auditTarget: { entityType: "Quotation", entityId: quotation.id },
  });

  return jsonSuccess(quotation, 201);
}
