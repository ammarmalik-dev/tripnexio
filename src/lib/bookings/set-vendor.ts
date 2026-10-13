import type { Prisma } from "../../generated/prisma/client";
import { writeAudit } from "../audit/log";
import { pickVendorRate } from "../vendors/service-rates";

export { DIRECT_VENDOR_NAME } from "./vendor-names";

/**
 * Client testing 2026-10-09 (E12) — records which vendor actually processes a
 * booking. A direct-payment booking (New Visa / OTB / Return Ticket) is
 * created with a placeholder vendor, so staff name the real one before the
 * request is applied; it can also be changed later with a reason. The vendor
 * lives on the lead's selected quotation (the booking's commercial record).
 * `vendor` is looked up by the caller BEFORE the transaction (no global `db`
 * inside one). Returns an error message, or null when saved.
 */
export async function setBookingVendor(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    leadId: string;
    vendor: { id: string; name: string };
    actor: { userId: string; name: string };
    reason?: string | null;
  }
): Promise<string | null> {
  const quotation = await tx.quotation.findFirst({
    where: { leadId: input.leadId, isSelected: true },
    select: { id: true, vendorId: true, sellingPrice: true, vendor: { select: { name: true } } },
  });
  if (!quotation) return "This booking has no selected quotation to record the vendor on.";
  if (quotation.vendorId === input.vendor.id) return null;

  // Client doc 2026-10-14 — OTB / Return Ticket: the vendor's rate for this country / airline /
  // processing type sets the booking's vendor cost (rate × passengers) and margin.
  const rated = await vendorRateCost(tx, input.bookingId, input.vendor.id);
  await tx.quotation.update({
    where: { id: quotation.id },
    data: {
      vendorId: input.vendor.id,
      ...(rated ? { vendorCost: rated.total, margin: Number(quotation.sellingPrice ?? 0) - rated.total } : {}),
    },
  });
  await writeAudit(tx, {
    entityType: "Booking",
    entityId: input.bookingId,
    action: "VENDOR_SET",
    byUserId: input.actor.userId,
    note: `Vendor ${quotation.vendor.name} -> ${input.vendor.name}${rated ? ` — vendor cost ₹${rated.total} (₹${rated.perPassenger} × ${rated.passengers} from the vendor rate)` : ""}${input.reason ? `: ${input.reason}` : ""} (by ${input.actor.name})`,
  });
  return null;
}

/** The vendor's rate for an OTB / Return Ticket booking × its passengers; null when none applies. */
async function vendorRateCost(
  tx: Prisma.TransactionClient,
  bookingId: string,
  vendorId: string
): Promise<{ total: number; perPassenger: number; passengers: number } | null> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { _count: { select: { passengers: true } }, lead: { select: { serviceType: true, details: true } } },
  });
  if (!booking || (booking.lead.serviceType !== "OTB" && booking.lead.serviceType !== "RETURN_TICKET")) return null;
  const details = (booking.lead.details ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const countryId =
    text(details.destinationCountryId) ??
    (text(details.destinationCountry)
      ? ((await tx.country.findFirst({ where: { code: { equals: text(details.destinationCountry)!, mode: "insensitive" } }, select: { id: true } }))?.id ?? null)
      : null);
  if (!countryId) return null;
  const airlineCode = text(details.airline);
  const airlineId = airlineCode ? ((await tx.airline.findUnique({ where: { code: airlineCode }, select: { id: true } }))?.id ?? null) : null;
  const rows = await tx.vendorServiceRate.findMany({
    where: { vendorId, serviceType: booking.lead.serviceType, countryId, active: true },
    select: { airlineId: true, processingType: true, cost: true },
  });
  const rate = pickVendorRate(rows, airlineId, text(details.processingType));
  if (!rate) return null;
  const passengers = Math.max(1, booking._count.passengers);
  const perPassenger = Number(rate.cost);
  return { total: Math.round(perPassenger * passengers * 100) / 100, perPassenger, passengers };
}
