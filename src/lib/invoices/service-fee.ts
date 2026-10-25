import type { Prisma } from "../../generated/prisma/client";
import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";

type Client = Prisma.TransactionClient | typeof db;

export interface ServiceInvoiceFee {
  /** The taxable service fee for this booking (per passenger × passengers, or per booking); null = not configured. */
  fee: number | null;
  /** GST as a fraction (0.18) for this service; null = use the Tax & Fees rate. */
  gstRate: number | null;
}

/**
 * Client 2026-10-25 ("GST off from system still calculated on the final page") — Admin → Tax & Fees is the master
 * switch: GST there at 0% = no GST on anything, whatever a service says. While it is on, a service's own GST %
 * (Admin → Services) replaces the Tax & Fees rate for that service.
 */
export function effectiveGstRate(taxFeeRate: number, serviceRate: number | null): number {
  if (taxFeeRate <= 0) return 0;
  return serviceRate ?? taxFeeRate;
}

/**
 * The taxable part of an amount: the service's invoice service fee when one is set (capped at the amount), else the
 * amount less its non-taxable Govt. / Airline / Vendor fee. One rule for the price preview and the payment.
 */
export function taxableServiceAmount(netAmount: number, configuredFee: number | null, nonTaxable = 0): number {
  return configuredFee !== null ? Math.min(configuredFee, Math.max(0, netAmount)) : Math.max(0, netAmount - nonTaxable);
}

/**
 * Client doc 2026-10-20 (F2/F3) — Admin sets each service's invoice service fee and GST %: the customer's invoice
 * shows only that fee (GST on it), the rest of the price is the Govt./Airline/Vendor fee. Internal profit
 * (selling − cost) is unaffected — reports keep using the quotation's margin.
 */
export async function serviceInvoiceFee(serviceType: ServiceType, passengerCount: number, client: Client = db): Promise<ServiceInvoiceFee> {
  const service = await client.service.findFirst({
    where: { code: serviceType },
    select: { invoiceServiceFee: true, invoiceServiceFeePerPassenger: true, gstRatePercent: true },
  });
  const base = service?.invoiceServiceFee != null ? Number(service.invoiceServiceFee) : null;
  const fee = base === null ? null : Math.round(base * (service?.invoiceServiceFeePerPassenger ? Math.max(1, passengerCount) : 1) * 100) / 100;
  const gstRate = service?.gstRatePercent != null ? Number(service.gstRatePercent) / 100 : null;
  return { fee, gstRate };
}
