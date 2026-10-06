import crypto from "crypto";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { bookingIdForLead } from "../bookings/reference";
import { applySystemEvent, dispatchStatusNotifications, getInitialServiceStatusId, type StatusNotification } from "../service-status/engine";
import { createPendingPayment } from "../payments/create-payment";
import { getProtectionPlanOffer, leadDestinationCountryCode, protectionPlanRowsForBooking } from "../protection-plan/country-offer";
import { resolveCouponForQuotation } from "../coupons/apply";
import { notifyNewBooking } from "../staff-notifications/triggers";
import type { ServiceType } from "../../generated/prisma/enums";
import { invoiceLinesGovernmentFee, type InvoiceLine } from "../invoices/invoice-lines";

const DIRECT_VENDOR_NAME = "Direct (auto-priced)";

/**
 * Pay-right-after-the-form (client's Return Ticket / OTB handover): the price
 * is already known from Admin configuration, so instead of waiting for a
 * staff quotation this creates — in one go — a selected Quotation at that
 * price, a pending Booking and a payment link, and returns the token for the
 * customer's /pay/<token> page. Staff still see and can edit all of it in the
 * CRM like any other lead. Returns null when there's nothing to charge.
 *
 * The quotation needs a vendor: an active vendor for the service if one
 * exists, otherwise an internal "Direct (auto-priced)" one (vendorCost 0, so
 * margin equals the price until staff enter the real cost).
 *
 * `vendorCost` (Step 40) is optional and defaults to 0 — only New Visa's
 * central PricingRule actually tracks a vendor cost figure today (OTB's
 * `Airline`/Return Ticket's `ReturnTicketDestination` have no such field),
 * so those two callers keep the pre-existing "margin equals the price"
 * behavior unless/until they gain one too.
 */
export async function createAutoCheckout(input: {
  leadId: string;
  serviceType: Extract<ServiceType, "OTB" | "RETURN_TICKET" | "NEW_VISA">;
  totalPrice: number;
  vendorCost?: number;
  /** Step 51 — Manual Lead's "permitted extra charges," added on top of totalPrice (mirrors Quotation.fineOrCharges). */
  extraCharges?: number;
  /** Step 51 — Manual Lead's "apply eligible coupons." Resolved the same way /api/quotations does; a bad code is a thrown error, not a silently-skipped discount, so the caller's own try/catch surfaces it to staff. */
  couponCode?: string;
  /**
   * Step 51 — the Manual Lead flow creates the Quotation+Booking upfront
   * but defers the payment itself until staff picks Payment Link or Bank
   * Transfer on the Booking detail page, unlike the website checkout
   * (which always wants a gateway link immediately). Defaults to false so
   * every existing caller (the 3 website intake routes) is unaffected.
   */
  skipAutoPayment?: boolean;
  /** Client corrections 2026-10-05 — invoice lines (per passenger type, government/airline fee apart); their total must equal totalPrice. */
  invoiceLines?: InvoiceLine[];
}): Promise<{ token: string; bookingId: string } | null> {
  const { leadId, serviceType, totalPrice, vendorCost = 0, extraCharges = 0, couponCode, skipAutoPayment = false, invoiceLines } = input;
  if (!(totalPrice > 0)) return null;

  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
  if (!lead) return null;

  const grossSellingPrice = totalPrice + extraCharges;
  let appliedCoupon: { couponId: string; couponCode: string; discountAmount: number } | null = null;
  if (couponCode) {
    const result = await resolveCouponForQuotation(couponCode, serviceType, grossSellingPrice, leadId);
    if (!result.ok) throw new Error(result.error);
    appliedCoupon = result.coupon;
  }
  const details = (lead.details ?? {}) as Record<string, unknown>;
  const passengerIds = Array.isArray(details.passengerIds) ? (details.passengerIds as string[]) : [];

  const vendor =
    (await db.vendor.findFirst({
      where: { active: true, services: { some: { service: serviceType } } },
      orderBy: { createdAt: "asc" },
    })) ?? (await db.vendor.create({ data: { name: DIRECT_VENDOR_NAME, services: { create: [{ service: serviceType }] } } }));

  const token = crypto.randomBytes(16).toString("hex");

  // New_Visa.md §6/step 10: "Protection Plan is offered after processing
  // selection and before payment" — the staff-driven createBookingFromQuotation
  // path already offers it for every New Visa booking; this auto-checkout
  // path needs the exact same offer since New Visa no longer goes through
  // that function (Step 35 pivot).
  const protectionPlanOffer = await getProtectionPlanOffer(leadDestinationCountryCode(serviceType, lead.details));

  const statusNotifications: (StatusNotification | null)[] = [];
  const { booking, quotation } = await db.$transaction(async (tx) => {
    const createdQuotation = await tx.quotation.create({
      data: {
        leadId,
        vendorId: vendor.id,
        vendorCost,
        feeAmount: totalPrice,
        fineOrCharges: extraCharges,
        sellingPrice: grossSellingPrice,
        ...(invoiceLines && invoiceLines.length > 0
          ? { invoiceLines: invoiceLines.map((line) => ({ ...line })), governmentFee: invoiceLinesGovernmentFee(invoiceLines) }
          : {}),
        margin: grossSellingPrice - vendorCost,
        couponId: appliedCoupon?.couponId,
        couponCode: appliedCoupon?.couponCode,
        couponDiscount: appliedCoupon?.discountAmount,
        isSelected: true,
        // P22 — an automatic quotation is live immediately (never a draft).
        sentAt: new Date(),
      },
    });
    // Step 49 — QUOTED -> QUOTATION_ACCEPTED; the quotation this creates is
    // always isSelected: true, so it's always the "accepted" step directly.
    await tx.lead.update({ where: { id: leadId }, data: { status: "QUOTATION_ACCEPTED" } });
    statusNotifications.push(
      await applySystemEvent(tx, { scope: "LEAD", entityId: leadId, event: "QUOTATION_ACCEPTED", actorLabel: "automatic checkout" })
    );

    const createdBooking = await tx.booking.create({
      data: {
        bookingId: await bookingIdForLead(tx, lead),
        serviceStatusId: await getInitialServiceStatusId(tx, serviceType, "BOOKING"),
        customerToken: token,
        leadId,
        customerId: lead.customerId,
        status: "PENDING",
      },
    });
    if (passengerIds.length > 0) {
      await tx.bookingPassenger.createMany({
        data: passengerIds.map((passengerId) => ({ bookingId: createdBooking.id, passengerId, status: "PENDING" as const })),
      });
    }

    // P12 — only where Admin enabled Protection Plan for the destination;
    // passengers chosen on the form (terms accepted) are charged now.
    const planRows = protectionPlanRowsForBooking({ bookingId: createdBooking.id, passengerIds, offer: protectionPlanOffer, leadDetails: lead.details });
    if (planRows.rows.length > 0) {
      await tx.protectionPlan.createMany({ data: planRows.rows });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: createdBooking.id,
        action: "PROTECTION_PLAN_OFFERED",
        note: `Protection Plan offered to ${planRows.rows.length} passenger(s) at ₹${protectionPlanOffer?.price} each${planRows.chosen > 0 ? `; ${planRows.chosen} chosen with terms accepted on the application form — terms shown: ${protectionPlanOffer?.termsText}` : ""}`,
      });
    }

    const source = skipAutoPayment ? "Manual Lead entry" : "website checkout";
    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: createdQuotation.id,
      action: "CREATE",
      note: `Automatic quotation ₹${grossSellingPrice} from Admin-configured pricing (${source})${vendorCost > 0 ? ` — vendor cost ₹${vendorCost}` : ""}${appliedCoupon ? `, coupon ${appliedCoupon.couponCode} applied (-₹${appliedCoupon.discountAmount})` : ""}`,
    });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: createdBooking.id,
      action: "CREATE",
      note:
        skipAutoPayment
          ? "Booking initiated from a staff-entered Manual Lead"
          : "Booking initiated automatically by the website checkout (pay right after the form)",
    });
    return { booking: createdBooking, quotation: createdQuotation };
  });

  // P22 — staff notifications feed (after commit, before the payment call so a gateway error can't skip it; never throws).
  await notifyNewBooking(booking.id);

  if (!skipAutoPayment) {
    await createPendingPayment({
      booking: { ...booking, customer: lead.customer, lead },
      quotation,
      actor: { label: "automatic website checkout" },
    });
  }

  await dispatchStatusNotifications(statusNotifications);
  return { token, bookingId: booking.id };
}
