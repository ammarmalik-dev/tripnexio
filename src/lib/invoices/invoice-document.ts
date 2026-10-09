import crypto from "crypto";
import { db } from "../db";
import { leadReference } from "../leads/reference";
import { subServiceLabel } from "../leads/sub-service-label";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { siteConfig } from "../site-config";
import { parseInvoiceLines } from "./invoice-lines";
import { getInvoiceCompanyDetails } from "./company-config";
import { ensureInvoiceNumber } from "./invoice-number";
import type { InvoiceCompanyDetails } from "./render-invoice";
import type { Quotation } from "../../generated/prisma/client";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Client corrections 2026-10-05 — everything an invoice shows, built from a
 * payment (Tax Invoice / Invoice) or a quotation (Proforma), in the layout of
 * the client's sample: government/airline fee apart from the service fee,
 * one line per passenger type, SAC per service, tax and total summaries,
 * amount paid / balance due and a "scan to verify" link. Pure data — the PDF
 * is drawn by render-invoice.ts.
 */
export interface InvoiceDocumentLine {
  description: string;
  sac: string | null;
  quantity: number;
  /** Line totals (unit × quantity). */
  governmentFee: number;
  serviceFee: number;
  gstAmount: number;
}

export interface InvoiceDocument {
  title: "TAX INVOICE" | "INVOICE" | "PROFORMA INVOICE";
  invoiceNumber: string;
  issuedAt: Date;
  bookingId: string | null;
  leadReference: string;
  serviceLabel: string;
  subService: string | null;
  paxCount: number | null;
  bookingDate: Date | null;
  travelDate: string | null;
  paymentStatus: "Paid" | "Pending" | "Estimate" | "Cancelled";
  customer: {
    name: string;
    mobile: string;
    email: string | null;
    /** Client corrections 2026-10-05 — billing details (Customer profile / Customer 360); null when not collected. */
    address: string | null;
    stateCode: string | null;
    gstin: string | null;
  };
  lines: InvoiceDocumentLine[];
  couponCode: string | null;
  couponDiscount: number;
  gstRatePercent: number;
  gstAmount: number;
  gatewayFee: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  verifyUrl: string | null;
  company: InvoiceCompanyDetails;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function invoiceCustomer(customer: {
  name: string;
  mobile: string;
  email: string | null;
  billingAddress: string | null;
  billingStateCode: string | null;
  gstin: string | null;
}): InvoiceDocument["customer"] {
  return {
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email,
    address: customer.billingAddress,
    stateCode: customer.billingStateCode,
    gstin: customer.gstin,
  };
}

/** The Admin-set SAC code of a service (Admin → Services), or null to use the Invoice Settings default. */
export async function serviceSacCode(serviceType: string): Promise<string | null> {
  try {
    const service = await db.service.findUnique({ where: { code: serviceType }, select: { sacCode: true } });
    return service?.sacCode?.trim() || null;
  } catch {
    return null;
  }
}

/** Keyed hash for the "scan to verify" link, so invoice numbers can't be enumerated. */
export function invoiceVerifyKey(invoiceNumber: string): string | null {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(`invoice:${invoiceNumber}`).digest("hex").slice(0, 24);
}

function verifyUrlFor(invoiceNumber: string): string | null {
  const key = invoiceVerifyKey(invoiceNumber);
  return key ? `${siteConfig.url}/verify-invoice/${encodeURIComponent(invoiceNumber)}?k=${key}` : null;
}

/**
 * The service part of the price as invoice lines: the quotation's snapshotted
 * per-passenger lines when they add up to `serviceAmount`, else one line for
 * the whole amount with the quotation's government fee (capped).
 */
function priceLines(input: {
  quotation: Pick<Quotation, "invoiceLines" | "governmentFee" | "fineOrCharges" | "otherCharges"> | null;
  serviceAmount: number;
  defaultDescription: string;
  sac: string | null;
}): Omit<InvoiceDocumentLine, "gstAmount">[] {
  const { quotation, serviceAmount, defaultDescription, sac } = input;
  const stored = quotation ? parseInvoiceLines(quotation.invoiceLines) : null;
  if (stored) {
    const lines = stored.map((line) => ({
      description: line.description,
      sac,
      quantity: line.quantity,
      governmentFee: round2(line.governmentFee * line.quantity),
      serviceFee: round2(line.serviceFee * line.quantity),
    }));
    const extras = round2(Number(quotation?.fineOrCharges ?? 0) + Number(quotation?.otherCharges ?? 0));
    if (extras > 0) lines.push({ description: "Additional charges", sac, quantity: 1, governmentFee: 0, serviceFee: extras });
    const sum = round2(lines.reduce((total, line) => total + line.governmentFee + line.serviceFee, 0));
    if (Math.abs(sum - serviceAmount) < 0.01) return lines;
  }
  const governmentFee = round2(Math.min(Math.max(Number(quotation?.governmentFee ?? 0), 0), serviceAmount));
  return [{ description: defaultDescription, sac, quantity: 1, governmentFee, serviceFee: round2(serviceAmount - governmentFee) }];
}

/** GST is charged on service fees only; the stored total is spread across lines in proportion (the last line takes the rounding). */
function withGst(lines: Omit<InvoiceDocumentLine, "gstAmount">[], gstAmount: number): InvoiceDocumentLine[] {
  const taxableTotal = lines.reduce((sum, line) => sum + line.serviceFee, 0);
  let remaining = round2(gstAmount);
  return lines.map((line, index) => {
    const share = index === lines.length - 1 ? remaining : taxableTotal > 0 ? round2((gstAmount * line.serviceFee) / taxableTotal) : 0;
    remaining = round2(remaining - share);
    return { ...line, gstAmount: share };
  });
}

function describeService(serviceType: ServiceType, details: unknown): { serviceLabel: string; subService: string | null } {
  return { serviceLabel: SERVICE_TYPE_LABELS[serviceType], subService: subServiceLabel(details) };
}

/** A successful payment's invoice ("TAX INVOICE" once a GSTIN is configured, else "INVOICE"). Null unless the payment succeeded. */
export async function buildPaymentInvoiceDocument(paymentId: string): Promise<InvoiceDocument | null> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: {
          customer: true,
          lead: { include: { quotations: { where: { isSelected: true }, take: 1 } } },
          _count: { select: { passengers: true } },
        },
      },
    },
  });
  if (!payment || payment.status !== "SUCCESS") return null;

  const invoiceNumber = await ensureInvoiceNumber(payment);
  const company = await getInvoiceCompanyDetails();
  const { booking } = payment;
  const lead = booking.lead;
  const sac = (await serviceSacCode(lead.serviceType)) ?? company.sacCode;
  const { serviceLabel, subService } = describeService(lead.serviceType, lead.details);

  const amount = Number(payment.amount);
  const planAmount = Number(payment.protectionPlanAmount ?? 0);
  const serviceAmount = round2(Math.max(0, amount - planAmount));
  const baseLines: Omit<InvoiceDocumentLine, "gstAmount">[] = [];
  if (serviceAmount >= 0.005) {
    if (payment.purpose === "EXTRA") {
      baseLines.push({ description: payment.description ?? "Extra Payment", sac, quantity: 1, governmentFee: 0, serviceFee: serviceAmount });
    } else {
      baseLines.push(
        ...priceLines({
          quotation: lead.quotations[0] ?? null,
          serviceAmount,
          defaultDescription: subService ? `${serviceLabel} — ${subService}` : serviceLabel,
          sac,
        })
      );
    }
  }
  if (planAmount > 0) baseLines.push({ description: "Protection Plan", sac, quantity: 1, governmentFee: 0, serviceFee: round2(planAmount) });

  const couponDiscount = Number(payment.couponDiscount ?? 0);
  const gstAmount = Number(payment.gstAmount);
  const gatewayFee = Number(payment.gatewayFee);
  const lines = withGst(baseLines, gstAmount);
  const taxable = Math.max(0, lines.reduce((sum, line) => sum + line.serviceFee, 0) - couponDiscount);
  const grandTotal = round2(amount - couponDiscount + gstAmount + gatewayFee);

  return {
    title: company.gstNumber ? "TAX INVOICE" : "INVOICE",
    invoiceNumber,
    issuedAt: payment.updatedAt,
    bookingId: booking.bookingId,
    leadReference: leadReference(lead),
    serviceLabel,
    subService,
    paxCount: booking._count.passengers || lead.paxCount,
    bookingDate: booking.createdAt,
    travelDate: lead.travelDate ? lead.travelDate.toISOString().slice(0, 10) : null,
    // Client testing 2026-10-09 (E5) — a cancelled / fully refunded booking's invoice is cancelled.
    paymentStatus: booking.status === "CANCELLED" || booking.status === "REFUNDED" ? "Cancelled" : "Paid",
    customer: invoiceCustomer(booking.customer),
    lines,
    couponCode: payment.couponCode,
    couponDiscount,
    gstRatePercent: taxable > 0 ? round2((gstAmount / taxable) * 100) : 0,
    gstAmount,
    gatewayFee,
    grandTotal,
    amountPaid: grandTotal,
    balanceDue: 0,
    verifyUrl: verifyUrlFor(invoiceNumber),
    company,
  };
}

/** A quotation's Proforma (pre-payment estimate; GST, if any, is added at payment time). */
export async function buildQuotationInvoiceDocument(quotationId: string): Promise<InvoiceDocument | null> {
  const quotation = await db.quotation.findUnique({ where: { id: quotationId }, include: { lead: { include: { customer: true } } } });
  if (!quotation) return null;
  const company = await getInvoiceCompanyDetails();
  const lead = quotation.lead;
  const sac = (await serviceSacCode(lead.serviceType)) ?? company.sacCode;
  const { serviceLabel, subService } = describeService(lead.serviceType, lead.details);
  const sellingPrice = Number(quotation.sellingPrice);
  const couponDiscount = Number(quotation.couponDiscount ?? 0);
  const lines = withGst(
    priceLines({ quotation, serviceAmount: sellingPrice, defaultDescription: subService ? `${serviceLabel} — ${subService}` : serviceLabel, sac }),
    0
  );
  const grandTotal = round2(sellingPrice - couponDiscount);
  return {
    title: "PROFORMA INVOICE",
    invoiceNumber: `PF-${quotation.id.slice(-8).toUpperCase()}`,
    issuedAt: quotation.createdAt,
    bookingId: null,
    leadReference: leadReference(lead),
    serviceLabel,
    subService,
    paxCount: lead.paxCount,
    bookingDate: null,
    travelDate: lead.travelDate ? lead.travelDate.toISOString().slice(0, 10) : null,
    paymentStatus: "Estimate",
    customer: invoiceCustomer(lead.customer),
    lines,
    couponCode: quotation.couponCode,
    couponDiscount,
    gstRatePercent: 0,
    gstAmount: 0,
    gatewayFee: 0,
    grandTotal,
    amountPaid: 0,
    balanceDue: grandTotal,
    verifyUrl: null,
    company,
  };
}
