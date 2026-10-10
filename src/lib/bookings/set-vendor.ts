import type { Prisma } from "../../generated/prisma/client";
import { writeAudit } from "../audit/log";

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
    select: { id: true, vendorId: true, vendor: { select: { name: true } } },
  });
  if (!quotation) return "This booking has no selected quotation to record the vendor on.";
  if (quotation.vendorId === input.vendor.id) return null;

  await tx.quotation.update({ where: { id: quotation.id }, data: { vendorId: input.vendor.id } });
  await writeAudit(tx, {
    entityType: "Booking",
    entityId: input.bookingId,
    action: "VENDOR_SET",
    byUserId: input.actor.userId,
    note: `Vendor ${quotation.vendor.name} -> ${input.vendor.name}${input.reason ? `: ${input.reason}` : ""} (by ${input.actor.name})`,
  });
  return null;
}
