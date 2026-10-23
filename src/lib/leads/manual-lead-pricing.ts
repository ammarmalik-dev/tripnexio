import type { PaxType } from "../../generated/prisma/enums";
import { db } from "../db";
import { priceLeadForDirectPayment, type DirectPaymentPrice } from "../checkout/lead-direct-payment";
import { resolveCouponForQuotation } from "../coupons/apply";
import { serviceInvoiceFee } from "../invoices/service-fee";
import { productLabel } from "../new-visa/products";
import type { ManualLeadValues } from "../validation/manual-lead-schema";

/** The Manual Lead form's travellers by type (OTB / Return Ticket ask one count). */
export function manualLeadPaxTypes(data: ManualLeadValues): PaxType[] {
  const single = data.serviceType === "OTB" || data.serviceType === "RETURN_TICKET";
  // New Visa / Visa Change have Adult and Child only (client 2026-10-05): an infant is priced as a Child, as on the website.
  const childOnly = data.serviceType === "NEW_VISA" || data.serviceType === "VISA_CHANGE";
  return [
    ...Array<PaxType>(data.adultCount).fill("ADULT"),
    ...Array<PaxType>(single ? 0 : data.childCount + (childOnly ? data.infantCount : 0)).fill("CHILD"),
    ...Array<PaxType>(single || childOnly ? 0 : data.infantCount).fill("INFANT"),
  ];
}

/**
 * Client doc 2026-10-20 (K1) — the service-specific lead details the Manual Lead form collects, in the
 * same keys the website intake stores (so pricing, CRM lists and the status templates read them alike).
 */
export async function manualLeadServiceDetails(data: ManualLeadValues): Promise<Record<string, unknown>> {
  switch (data.serviceType) {
    case "NEW_VISA": {
      const product = data.newVisaConfigId
        ? await db.newVisaCountryConfig.findUnique({
            where: { id: data.newVisaConfigId },
            select: { id: true, stayDays: true, duration: true, entryKind: true, entryType: true, visaCategory: true },
          })
        : null;
      const nationality = data.nationalityId ? await db.nationality.findFirst({ where: { id: data.nationalityId, active: true }, select: { id: true, name: true } }) : null;
      return {
        destinationCountry: data.destinationCountryCode,
        processingType: data.processingType,
        ...(product ? { newVisaConfigId: product.id, visaOption: productLabel(product) } : {}),
        ...(nationality ? { nationalityId: nationality.id, nationality: nationality.name } : {}),
      };
    }
    case "OTB":
      return { airline: data.airlineCode, destinationCountry: data.destinationCountryCode, processingType: data.processingType };
    case "RETURN_TICKET": {
      const destination = data.returnTicketDestinationCountryId
        ? await db.country.findUnique({ where: { id: data.returnTicketDestinationCountryId }, select: { name: true } })
        : null;
      return {
        destinationCountry: destination?.name ?? null,
        destinationCountryId: data.returnTicketDestinationCountryId,
        expectedReturnDate: data.returnTicketExpectedReturnDate,
      };
    }
    case "VISA_EXTENSION":
      return { visaExpiryDate: data.visaExpiryDate };
    case "VISA_CHANGE":
      return { visaLastDate: data.visaExpiryDate };
    default:
      return {};
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export type ManualLeadPricePreview =
  | {
      available: true;
      /** The Admin-configured amount for these travellers. */
      configuredAmount: number;
      /** The configured invoice service fee (Admin → Services); the rest is the Govt./Airline/Vendor fee. Null = not set. */
      serviceFee: number | null;
      extraCharges: number;
      couponDiscount: number;
      couponError: string | null;
      finalPayable: number;
    }
  | { available: false; reason: string; byQuotation: boolean };

/** The same price the lead's payment link will carry: configured amount + permitted extra charges − coupon. */
export async function previewManualLeadPrice(data: ManualLeadValues, details: Record<string, unknown>): Promise<{ preview: ManualLeadPricePreview; price: DirectPaymentPrice }> {
  const paxTypes = manualLeadPaxTypes(data);
  const price = await priceLeadForDirectPayment({ serviceType: data.serviceType, details, paxCount: paxTypes.length, paxTypes });
  if (!price.ok) {
    return { price, preview: { available: false, reason: price.error, byQuotation: price.error.includes("quotation") } };
  }
  const extraCharges = Math.max(0, data.extraCharges ?? 0);
  const gross = round2(price.totalPrice + extraCharges);
  let couponDiscount = 0;
  let couponError: string | null = null;
  if (data.couponCode) {
    const coupon = await resolveCouponForQuotation(data.couponCode, data.serviceType, gross, ""); // a new lead: no lead-scoped coupon applies
    if (coupon.ok) couponDiscount = coupon.coupon.discountAmount;
    else couponError = coupon.error;
  }
  const fee = await serviceInvoiceFee(data.serviceType, paxTypes.length);
  return {
    price,
    preview: {
      available: true,
      configuredAmount: price.totalPrice,
      serviceFee: fee.fee,
      extraCharges,
      couponDiscount,
      couponError,
      finalPayable: round2(gross - couponDiscount),
    },
  };
}
