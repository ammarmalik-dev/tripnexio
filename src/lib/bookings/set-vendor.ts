import type { Prisma } from "../../generated/prisma/client";
import { writeAudit } from "../audit/log";
import { pickVendorRate } from "../vendors/service-rates";
import type { ServiceType } from "../../generated/prisma/enums";
import { bookingDocumentsWhere } from "../documents/document-lead";
import { documentsValidatedBlock, type ReadinessDocument } from "./documents-ready";

export { DIRECT_VENDOR_NAME, VENDOR_AFTER_DOCUMENTS_SERVICES } from "./vendor-names";
import { DIRECT_VENDOR_NAME, VENDOR_AFTER_DOCUMENTS_SERVICES } from "./vendor-names";

/**
 * Client doc 2026-10-15 (I7) — OTB / New Visa / Return Ticket: staff pick the vendor (from the vendors
 * enabled for the service) once every customer document is validated, and its buying rate sets the
 * vendor cost. Visa Change / Visa Extension / Special Fare: the vendor comes from the selected quotation.
 */

/** Why the booking's vendor can't be picked yet (or at all) — null when it can. */
export function vendorChoiceBlock(serviceType: ServiceType, documents: ReadinessDocument[], cancelledPassengerIds: Iterable<string> = []): string | null {
  if (!VENDOR_AFTER_DOCUMENTS_SERVICES.has(serviceType)) return "The vendor comes from the selected quotation.";
  // Client doc 2026-10-27 (C1) — the same rule as Sent to Airlines / Applied (latest copy per passenger × document).
  // A cancelled passenger's documents don't count (the same as the status engine's check).
  if (documentsValidatedBlock(documents, cancelledPassengerIds)) return "Pick the vendor once every document is validated.";
  return null;
}

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
    select: { id: true, vendorId: true, sellingPrice: true, invoiceLines: true, vendor: { select: { name: true } } },
  });
  if (!quotation) return "This booking has no selected quotation to record the vendor on.";
  if (quotation.vendorId === input.vendor.id) return null;

  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: input.bookingId },
    select: { id: true, leadId: true, lead: { select: { serviceType: true } }, passengers: { where: { outcome: "CANCELLED" }, select: { passengerId: true } } },
  });
  const documents = await tx.document.findMany({ where: bookingDocumentsWhere(booking), select: { type: true, status: true, passengerId: true, createdAt: true, purgedAt: true } });
  const blocked = vendorChoiceBlock(booking.lead.serviceType, documents, booking.passengers.map((row) => row.passengerId));
  if (blocked) return blocked;

  // Client doc 2026-10-14 — OTB / Return Ticket: the vendor's rate for this country / airline /
  // processing type sets the booking's vendor cost (rate × passengers) and margin.
  // Client doc 2026-10-15 — New Visa: per passenger by nationality + Adult / Child; the vendor
  // cost is also the invoice's Govt./Vendor fee, so GST applies to selling − vendor cost only.
  const rated = await vendorRateCost(tx, input.bookingId, input.vendor.id);
  await tx.quotation.update({
    where: { id: quotation.id },
    data: {
      vendorId: input.vendor.id,
      ...(rated ? { vendorCost: rated.total, margin: Number(quotation.sellingPrice ?? 0) - rated.total } : {}),
      ...(rated?.serviceType === "NEW_VISA" ? { governmentFee: rated.total, invoiceLines: rated.invoiceLines(quotation.invoiceLines) } : {}),
    },
  });
  await writeAudit(tx, {
    entityType: "Booking",
    entityId: input.bookingId,
    action: "VENDOR_SET",
    byUserId: input.actor.userId,
    note: `Vendor ${quotation.vendor.name} -> ${input.vendor.name}${rated ? ` — vendor cost ₹${rated.total} (${rated.summary} from the vendor rate)` : ""}${input.reason ? `: ${input.reason}` : ""} (by ${input.actor.name})`,
  });
  return null;
}

interface RatedCost {
  serviceType: string;
  total: number;
  summary: string;
  /** New Visa — the stored invoice lines with each passenger type's vendor cost as its Govt./Vendor fee. */
  invoiceLines: (stored: unknown) => Prisma.InputJsonValue | undefined;
}

/** The vendor's rate for an OTB / Return Ticket / New Visa booking × its passengers; null when none applies. */
async function vendorRateCost(tx: Prisma.TransactionClient, bookingId: string, vendorId: string): Promise<RatedCost | null> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      _count: { select: { passengers: true } },
      passengers: { select: { passenger: { select: { paxType: true, nationalityId: true } } } },
      lead: { select: { serviceType: true, details: true } },
    },
  });
  const serviceType = booking?.lead.serviceType;
  if (!booking || (serviceType !== "OTB" && serviceType !== "RETURN_TICKET" && serviceType !== "NEW_VISA")) return null;
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
    where: { vendorId, serviceType, countryId, active: true },
    select: { airlineId: true, processingType: true, nationalityId: true, paxType: true, newVisaConfigId: true, cost: true },
  });
  const processingType = text(details.processingType);
  const round2 = (value: number) => Math.round(value * 100) / 100;

  if (serviceType === "NEW_VISA") {
    const travellers = booking.passengers.map((entry) => entry.passenger);
    if (travellers.length === 0) return null;
    const costs: { paxType: string; cost: number }[] = [];
    for (const traveller of travellers) {
      const rate = pickVendorRate(rows, {
        processingType,
        nationalityId: traveller.nationalityId ?? text(details.nationalityId),
        paxType: traveller.paxType,
        // Client doc 2026-10-27 (E2) — the visa option / type the customer chose.
        newVisaConfigId: text(details.newVisaConfigId),
      });
      if (!rate) return null; // a passenger with no rate from this vendor: leave the cost for staff to enter
      costs.push({ paxType: traveller.paxType, cost: Number(rate.cost) });
    }
    const total = round2(costs.reduce((sum, entry) => sum + entry.cost, 0));
    const perType = new Map<string, number>();
    for (const entry of costs) perType.set(entry.paxType, entry.cost);
    return {
      serviceType,
      total,
      summary: costs.map((entry) => `${entry.paxType} ₹${entry.cost}`).join(" + "),
      invoiceLines: (stored) => withVendorFees(stored, perType),
    };
  }

  const rate = pickVendorRate(rows, { airlineId, processingType });
  if (!rate) return null;
  const passengers = Math.max(1, booking._count.passengers);
  const perPassenger = Number(rate.cost);
  return { serviceType, total: round2(perPassenger * passengers), summary: `₹${perPassenger} × ${passengers}`, invoiceLines: () => undefined };
}

/**
 * New Visa invoice lines ("<Country> Visa — Adult" × n …) with each line's Govt./Vendor fee set to
 * the vendor's cost for that passenger type; the line price stays, the rest is the service fee.
 */
function withVendorFees(stored: unknown, perType: Map<string, number>): Prisma.InputJsonValue | undefined {
  if (!Array.isArray(stored)) return undefined;
  const typeOf = (description: string) => (/child/i.test(description) ? "CHILD" : /infant/i.test(description) ? "INFANT" : "ADULT");
  return stored.map((line) => {
    if (!line || typeof line !== "object") return line;
    const entry = line as Record<string, unknown>;
    const fee = perType.get(typeOf(String(entry.description ?? "")));
    if (fee === undefined) return entry;
    const price = Number(entry.governmentFee ?? 0) + Number(entry.serviceFee ?? 0);
    const governmentFee = Math.min(fee, price);
    return { ...entry, governmentFee, serviceFee: Math.round((price - governmentFee) * 100) / 100 };
  }) as Prisma.InputJsonValue;
}

export interface VendorRateOption {
  id: string;
  name: string;
  /** The booking's vendor cost at this vendor's rate (rate × passengers) — internal. */
  cost: number;
  summary: string;
}

/**
 * Client doc 2026-10-27 (C13) — the vendors staff choose from at Sent to Airlines / Applied to Embassy: the active
 * vendors with an active rate (Pricing Dashboard → vendor rates) for this booking's service, country, airline,
 * processing type (and, New Visa, every passenger's nationality / type), each with the cost it would set.
 */
export async function bookingVendorRateOptions(client: Prisma.TransactionClient, bookingId: string): Promise<VendorRateOption[]> {
  const booking = await client.booking.findUnique({ where: { id: bookingId }, select: { lead: { select: { serviceType: true } } } });
  const serviceType = booking?.lead.serviceType;
  if (!serviceType || !VENDOR_AFTER_DOCUMENTS_SERVICES.has(serviceType)) return [];
  const vendors = await client.vendor.findMany({
    where: { active: true, name: { not: DIRECT_VENDOR_NAME }, serviceRates: { some: { serviceType, active: true } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const options: VendorRateOption[] = [];
  for (const vendor of vendors) {
    const rated = await vendorRateCost(client, bookingId, vendor.id);
    if (rated) options.push({ id: vendor.id, name: vendor.name, cost: rated.total, summary: rated.summary });
  }
  return options;
}

/**
 * Client doc 2026-10-27 (C13) — the vendor picked at the apply step must have a rate for the booking (so P&L uses
 * it), unless no vendor has one configured yet (then any active vendor, and staff enter the cost). Null when fine.
 */
export async function vendorRateProblem(client: Prisma.TransactionClient, bookingId: string, vendorId: string): Promise<string | null> {
  const options = await bookingVendorRateOptions(client, bookingId);
  if (options.length === 0 || options.some((option) => option.id === vendorId)) return null;
  return "Pick a vendor with a rate for this booking (Pricing Dashboard → vendor rates).";
}
