import crypto from "crypto";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { placeholderBookingId } from "../bookings/reference";
import { createPendingPayment } from "../payments/create-payment";
import type { ServiceType } from "../../generated/prisma/enums";

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
 */
export async function createAutoCheckout(input: {
  leadId: string;
  serviceType: Extract<ServiceType, "OTB" | "RETURN_TICKET">;
  totalPrice: number;
}): Promise<{ token: string } | null> {
  const { leadId, serviceType, totalPrice } = input;
  if (!(totalPrice > 0)) return null;

  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
  if (!lead) return null;
  const details = (lead.details ?? {}) as Record<string, unknown>;
  const passengerIds = Array.isArray(details.passengerIds) ? (details.passengerIds as string[]) : [];

  const vendor =
    (await db.vendor.findFirst({ where: { service: serviceType, active: true }, orderBy: { createdAt: "asc" } })) ??
    (await db.vendor.create({ data: { name: DIRECT_VENDOR_NAME, service: serviceType } }));

  const token = crypto.randomBytes(16).toString("hex");

  const { booking, quotation } = await db.$transaction(async (tx) => {
    const createdQuotation = await tx.quotation.create({
      data: {
        leadId,
        vendorId: vendor.id,
        vendorCost: 0,
        feeAmount: totalPrice,
        fineOrCharges: 0,
        sellingPrice: totalPrice,
        margin: totalPrice,
        isSelected: true,
      },
    });
    await tx.lead.update({ where: { id: leadId }, data: { status: "QUOTED" } });

    const createdBooking = await tx.booking.create({
      data: {
        bookingId: placeholderBookingId(),
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

    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: createdQuotation.id,
      action: "CREATE",
      note: `Automatic quotation ₹${totalPrice} from Admin-configured pricing (website checkout)`,
    });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: createdBooking.id,
      action: "CREATE",
      note: "Booking initiated automatically by the website checkout (pay right after the form)",
    });
    return { booking: createdBooking, quotation: createdQuotation };
  });

  await createPendingPayment({
    booking: { ...booking, customer: lead.customer, lead },
    quotation,
    actor: { label: "automatic website checkout" },
  });

  return { token };
}
