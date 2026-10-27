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
 * The taxable part of an amount: the service's invoice service fee (capped at the amount). Client doc 2026-10-27
 * (C5/F2) — "GST only on the configured service fee, never on the whole amount": with no service fee set in
 * Admin → Services there is nothing taxable (the whole price is the Govt./Airline/Vendor fee) — the margin
 * (selling − cost) is never the service fee. One rule for the price preview and the payment.
 */
export function taxableServiceAmount(netAmount: number, configuredFee: number | null): number {
  return configuredFee !== null ? Math.min(configuredFee, Math.max(0, netAmount)) : 0;
}

const roundToPaise = (value: number) => Math.round(value * 100) / 100;

/**
 * Client doc 2026-10-27 (C5/E4/F2) — the customer-facing split of one payment, stored on Payment.invoiceServiceFee:
 * service fee = the configured fee (capped at the price less any Protection Plan; 0 when none is configured or for
 * an extra payment — fare differences and fines are pass-through), GST = rate × (service fee + Protection Plan).
 * The rest of the price is the Govt./Airline/Vendor fee. Internal profit (selling − cost) is not involved.
 */
export function paymentServiceFeeSplit(input: {
  netAmount: number;
  planAmount: number;
  configuredFee: number | null;
  extra: boolean;
  gstRate: number;
}): { invoiceServiceFee: number; gstAmount: number } {
  const plan = input.extra ? 0 : Math.max(0, input.planAmount);
  const invoiceServiceFee = input.extra ? 0 : roundToPaise(taxableServiceAmount(Math.max(0, input.netAmount - plan), input.configuredFee));
  return { invoiceServiceFee, gstAmount: roundToPaise((invoiceServiceFee + plan) * input.gstRate) };
}

/**
 * Client doc 2026-10-27 (C5) — what the pay page and invoice show: the Govt./Airline/Vendor fee part and the service
 * fee part of a payment's amount (Protection Plan excluded). `serviceFee` null = an older payment taken before the
 * snapshot existed (show the amount as one line).
 */
export function displayFeeSplit(input: { amount: number; protectionPlan: number; invoiceServiceFee: number | null }): {
  passThroughFee: number;
  serviceFee: number | null;
} {
  const base = roundToPaise(Math.max(0, input.amount - input.protectionPlan));
  if (input.invoiceServiceFee === null) return { passThroughFee: 0, serviceFee: null };
  const serviceFee = roundToPaise(Math.min(Math.max(0, input.invoiceServiceFee), base));
  return { passThroughFee: roundToPaise(base - serviceFee), serviceFee };
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
