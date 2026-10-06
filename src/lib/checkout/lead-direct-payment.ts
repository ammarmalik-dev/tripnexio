import type { PaxType, ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { computeNewVisaPrice } from "../new-visa/pricing";
import { resolveOtbApplicantPrices } from "../otb/pricing";
import { groupInvoiceLines, PAX_LINE_LABELS, type InvoiceLine } from "../invoices/invoice-lines";
import { isFixedRateService } from "../validation/manual-lead-schema";

export type DirectPaymentPrice =
  | { ok: true; serviceType: "NEW_VISA" | "OTB" | "RETURN_TICKET"; totalPrice: number; vendorCost?: number; invoiceLines?: InvoiceLine[] }
  | { ok: false; error: string };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The lead's own travellers by passenger type — its linked passengers, else its PAX count as adults. */
async function leadPaxTypes(details: Record<string, unknown>, paxCount: number | null): Promise<PaxType[]> {
  const ids = Array.isArray(details.passengerIds) ? details.passengerIds.filter((id): id is string => typeof id === "string") : [];
  if (ids.length > 0) {
    const passengers = await db.passenger.findMany({ where: { id: { in: ids } }, select: { paxType: true } });
    if (passengers.length > 0) return passengers.map((passenger) => passenger.paxType ?? "ADULT");
  }
  return Array.from({ length: Math.max(1, paxCount ?? 1) }, () => "ADULT" as const);
}

/**
 * Client corrections 2026-10-05 §7/§16 — New Visa, OTB and Return Ticket go
 * Lead → Direct Payment Link → Booking, no quotation. Prices the lead from
 * the same Admin configuration its website checkout uses (New Visa
 * PricingRule, OTB price by airline + destination + passenger type, Return
 * Ticket destination rate) — never a guessed price: anything unconfigured
 * is an error telling staff what's missing.
 */
export async function priceLeadForDirectPayment(lead: {
  serviceType: ServiceType;
  details: unknown;
  paxCount: number | null;
}): Promise<DirectPaymentPrice> {
  if (!isFixedRateService(lead.serviceType)) {
    return { ok: false, error: "This service is priced by quotation — build a quote instead." };
  }
  const details = (lead.details ?? {}) as Record<string, unknown>;
  const paxTypes = await leadPaxTypes(details, lead.paxCount);
  const processingType = details.processingType === "urgent" ? "urgent" : details.processingType === "normal" ? "normal" : null;

  if (lead.serviceType === "NEW_VISA") {
    const countryCode = text(details.destinationCountry);
    if (!countryCode || !processingType) return { ok: false, error: "The lead has no destination country / processing type to price it." };
    const price = await computeNewVisaPrice({ countryCode, newVisaConfigId: text(details.newVisaConfigId), processingType, travellerPaxTypes: paxTypes });
    if (!price) return { ok: false, error: `No New Visa price is configured for ${countryCode} (${processingType}) for these travellers.` };
    return { ok: true, serviceType: "NEW_VISA", totalPrice: price.total, vendorCost: price.vendorCost, invoiceLines: price.invoiceLines };
  }

  if (lead.serviceType === "OTB") {
    const airlineCode = text(details.airline);
    const countryCode = text(details.destinationCountry);
    if (!airlineCode || !countryCode || !processingType) return { ok: false, error: "The lead has no airline / destination / processing type to price it." };
    const airline = await db.airline.findFirst({ where: { code: airlineCode, active: true, otbRequired: true } });
    if (!airline) return { ok: false, error: `Airline ${airlineCode} isn't active for OTB.` };
    const quotes = await resolveOtbApplicantPrices({ airline, countryCode, processingType, paxTypes });
    if (quotes.some((quote) => quote.price === null || !(quote.price > 0))) {
      return { ok: false, error: `No ${processingType} OTB price is configured for ${airline.name} to ${countryCode} for these travellers.` };
    }
    const prices = quotes.map((quote) => quote.price as number);
    return {
      ok: true,
      serviceType: "OTB",
      totalPrice: prices.reduce((sum, price) => sum + price, 0),
      invoiceLines: groupInvoiceLines(
        paxTypes.map((paxType, index) => ({ label: `OTB — ${PAX_LINE_LABELS[paxType]}`, price: prices[index], governmentFee: quotes[index].airlineFee }))
      ),
    };
  }

  // RETURN_TICKET
  const destinationCountryId = text(details.destinationCountryId);
  if (!destinationCountryId) return { ok: false, error: "The lead has no Return Ticket destination to price it." };
  const destination = await db.returnTicketDestination.findFirst({
    where: { countryId: destinationCountryId, active: true, country: { active: true } },
    include: { country: { select: { name: true } } },
  });
  if (!destination) return { ok: false, error: "That Return Ticket destination isn't active." };
  const rate = Number(destination.ratePerApplicant);
  if (!(rate > 0)) return { ok: false, error: `No Return Ticket rate is configured for ${destination.country.name}.` };
  const fee = Number(destination.airlineFeePerApplicant);
  return {
    ok: true,
    serviceType: "RETURN_TICKET",
    totalPrice: rate * paxTypes.length,
    invoiceLines: [
      {
        description: `Return Verified Ticket — ${destination.country.name}`,
        quantity: paxTypes.length,
        governmentFee: Math.min(fee, rate),
        serviceFee: Math.max(0, rate - fee),
      },
    ],
  };
}
