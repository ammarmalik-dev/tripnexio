import type { Prisma } from "../../generated/prisma/client";
import type { PaymentMethod, PaymentPurpose, ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { leadReference } from "../leads/reference";
import { paymentTotal } from "../payments/totals";
import { compareInvoices, invoiceRefundState, roundMoney, type InvoiceRefundState, type InvoiceSort } from "./invoice-filters";
import { buildInvoiceWhere, type InvoiceQuery } from "./invoice-query";
import type { ServiceScopeCheckable } from "../auth/service-scope";
import { getTimezoneOffsetMinutes } from "../settings/system-config";

/**
 * Invoice History register (server only). An invoice is a SUCCESS Payment.
 *
 * The set is resolved in two steps so that refund-state filtering, sorting
 * by the computed total, and the whole-set summary are always exact:
 * 1. a light query of every matching payment (amounts + COMPLETED refund
 *    amounts only), filtered/sorted/summed in memory;
 * 2. full rows fetched only for the ids actually needed (one page, the CSV,
 *    or the ZIP).
 *
 * Never selects or returns vendorCost/margin — invoices are customer money only.
 */

interface ResolvedInvoice {
  id: string;
  issuedAt: Date;
  total: number;
  gstAmount: number;
  refundedAmount: number;
  refundState: InvoiceRefundState;
}

export interface InvoiceSummary {
  count: number;
  totalInvoiced: number;
  totalGst: number;
  totalRefunded: number;
  /** totalInvoiced − totalRefunded. */
  net: number;
}

export interface InvoiceListItem {
  paymentId: string;
  /** Null only for an old SUCCESS row that hasn't been given a number yet (assigned on first PDF download). */
  invoiceNumber: string | null;
  issuedAt: string;
  /** Booking display id (the lead reference, or "-2" etc.). */
  bookingRef: string;
  /** Booking database id — for /crm/bookings/[id]. */
  bookingId: string;
  leadId: string;
  leadReference: string;
  serviceType: ServiceType;
  customer: { name: string; mobile: string; email: string | null };
  baseAmount: number;
  couponCode: string | null;
  couponDiscount: number;
  protectionPlanAmount: number;
  gstAmount: number;
  gatewayFee: number;
  total: number;
  method: PaymentMethod;
  purpose: PaymentPurpose;
  refundedAmount: number;
  refundState: InvoiceRefundState;
}

/** Step 1 — every matching invoice id in the requested order, plus the summary of the whole set. */
export async function resolveInvoiceSet(
  where: Prisma.PaymentWhereInput,
  refundState: InvoiceQuery["refundState"],
  sort: InvoiceSort
): Promise<{ invoices: ResolvedInvoice[]; summary: InvoiceSummary }> {
  const rows = await db.payment.findMany({
    where,
    select: {
      id: true,
      updatedAt: true,
      amount: true,
      couponDiscount: true,
      gstAmount: true,
      gatewayFee: true,
      refunds: { where: { status: "COMPLETED" }, select: { refundAmount: true } },
    },
  });

  const resolved: ResolvedInvoice[] = rows.map((row) => {
    const total = paymentTotal(row);
    const refundedAmount = roundMoney(row.refunds.reduce((sum, refund) => sum + Number(refund.refundAmount), 0));
    return {
      id: row.id,
      issuedAt: row.updatedAt,
      total,
      gstAmount: Number(row.gstAmount),
      refundedAmount,
      refundState: invoiceRefundState(total, refundedAmount),
    };
  });

  const invoices = (refundState ? resolved.filter((invoice) => invoice.refundState === refundState) : resolved).sort(compareInvoices(sort));

  const totalInvoiced = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.total, 0));
  const totalGst = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.gstAmount, 0));
  const totalRefunded = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.refundedAmount, 0));

  return {
    invoices,
    summary: { count: invoices.length, totalInvoiced, totalGst, totalRefunded, net: roundMoney(totalInvoiced - totalRefunded) },
  };
}

/** buildInvoiceWhere + resolveInvoiceSet in one call — what every Invoice History route does first. */
export async function loadInvoiceSet(session: ServiceScopeCheckable, query: InvoiceQuery) {
  const timezoneOffsetMinutes = await getTimezoneOffsetMinutes(db);
  return resolveInvoiceSet(buildInvoiceWhere(session, query, timezoneOffsetMinutes), query.refundState, query.sort);
}

const invoiceInclude = {
  booking: { include: { customer: true, lead: true } },
  refunds: { where: { status: "COMPLETED" as const }, select: { refundAmount: true } },
} satisfies Prisma.PaymentInclude;

export type InvoicePaymentRow = Prisma.PaymentGetPayload<{ include: typeof invoiceInclude }>;

/** Step 2 — the full payment rows for `ids`, returned in the same order as `ids`. */
export async function fetchInvoicePayments(ids: string[]): Promise<InvoicePaymentRow[]> {
  if (ids.length === 0) return [];
  const rows = await db.payment.findMany({ where: { id: { in: ids } }, include: invoiceInclude });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

export function toInvoiceListItem(payment: InvoicePaymentRow): InvoiceListItem {
  const total = paymentTotal(payment);
  const refundedAmount = roundMoney(payment.refunds.reduce((sum, refund) => sum + Number(refund.refundAmount), 0));
  return {
    paymentId: payment.id,
    invoiceNumber: payment.invoiceNumber,
    issuedAt: payment.updatedAt.toISOString(),
    bookingRef: payment.booking.bookingId,
    bookingId: payment.booking.id,
    leadId: payment.booking.lead.id,
    leadReference: leadReference(payment.booking.lead),
    serviceType: payment.booking.lead.serviceType,
    customer: {
      name: payment.booking.customer.name,
      mobile: payment.booking.customer.mobile,
      email: payment.booking.customer.email,
    },
    baseAmount: Number(payment.amount),
    couponCode: payment.couponCode,
    couponDiscount: Number(payment.couponDiscount ?? 0),
    protectionPlanAmount: Number(payment.protectionPlanAmount),
    gstAmount: Number(payment.gstAmount),
    gatewayFee: Number(payment.gatewayFee),
    total,
    method: payment.method,
    purpose: payment.purpose,
    refundedAmount,
    refundState: invoiceRefundState(total, refundedAmount),
  };
}
