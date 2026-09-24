import PDFDocument from "pdfkit";
import { db } from "../db";
import { formatLeadReference } from "../leads/reference";
import { formatCurrency } from "../format-currency";
import { getInvoiceCompanyDetails } from "./company-config";

/** @deprecated Kept for any external caller expecting the old fixed-INR formatter — renderInvoicePdf itself now uses formatCurrency(value, company.currencyCode) so amounts respect the Admin-configured currency (Step 45). */
export function money(value: number): string {
  return formatCurrency(value, "INR");
}

/** Resolved InvoiceConfig + effective company identity (Step 45's SystemConfig overrides merged over site-config.ts), with logo/signature already read into Buffers — see company-config.ts. */
export interface InvoiceCompanyDetails {
  legalName: string;
  address: string;
  phone: string;
  email: string;
  currencyCode: string;
  gstNumber: string | null;
  sacCode: string | null;
  logoBuffer: Buffer | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankName: string | null;
  bankBranch: string | null;
  termsAndNotes: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  signatureBuffer: Buffer | null;
}

export interface InvoicePdfInput {
  /** Step 44 — Quotation-backed invoices are always a Proforma, regardless of the GST rate (a quotation has no computed GST yet). */
  isProforma?: boolean;
  invoiceNumber: string;
  issuedAt: Date;
  /** Null for a Proforma built from a Quotation — no Booking exists yet at that stage. */
  bookingId: string | null;
  leadReference: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string | null;
  /** Line-item service description — e.g. "New Visa — Service Fee". */
  description: string;
  baseFare: number;
  /** CRM.md §8: "Coupon discount must remain a separate invoice line" (Step 22, audit §7.8) — null/0 renders no line at all. */
  couponCode: string | null;
  couponDiscount: number;
  gstAmount: number;
  gstRatePercent: number;
  gatewayFee: number;
  total: number;
  company: InvoiceCompanyDetails;
}

function drawBankDetails(doc: PDFKit.PDFDocument, company: InvoiceCompanyDetails) {
  const hasBankDetails = company.bankAccountNumber || company.bankName || company.bankIfscCode;
  if (!hasBankDetails) return;

  doc.fontSize(10).fillColor("#000000").text("Payment Details", { underline: true });
  doc.fontSize(9).fillColor("#333333");
  if (company.bankAccountName) doc.text(`Account Name: ${company.bankAccountName}`);
  if (company.bankAccountNumber) doc.text(`Account Number: ${company.bankAccountNumber}`);
  if (company.bankIfscCode) doc.text(`IFSC: ${company.bankIfscCode}`);
  if (company.bankName) doc.text(`Bank: ${company.bankName}${company.bankBranch ? `, ${company.bankBranch}` : ""}`);
  doc.moveDown(1);
}

function drawSignatory(doc: PDFKit.PDFDocument, company: InvoiceCompanyDetails) {
  if (!company.signatoryName && !company.signatureBuffer) {
    doc.fontSize(8).fillColor("#999999").text("This is a computer-generated invoice and does not require a signature.", 50, doc.y, {
      align: "center",
      width: 495,
    });
    return;
  }

  doc.fontSize(9).fillColor("#333333").text(`For ${company.legalName}`, { align: "right" });
  doc.moveDown(2.5);
  if (company.signatureBuffer) {
    try {
      doc.image(company.signatureBuffer, 445, doc.y - 30, { width: 100, height: 40, fit: [100, 40] });
    } catch (error) {
      console.error("[render-invoice] couldn't draw signature image", error);
    }
  }
  doc.fontSize(9).fillColor("#000000").text(company.signatoryName ?? "", { align: "right" });
  if (company.signatoryTitle) doc.fontSize(8).fillColor("#555555").text(company.signatoryTitle, { align: "right" });
}

/**
 * Pure PDF renderer — shared by the staff-facing download routes
 * (/api/payments/[id]/invoice, /api/quotations/[id]/invoice), and the
 * PAYMENT_RECEIVED email trigger (src/lib/payments/notify-payment-received.ts),
 * which attaches the exact same PDF to the customer's receipt email. Never
 * fetches anything itself — company.logoBuffer/signatureBuffer are already
 * resolved bytes by the time they reach here (see company-config.ts).
 */
export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const headerTop = doc.y;
  if (input.company.logoBuffer) {
    try {
      doc.image(input.company.logoBuffer, 50, headerTop, { width: 90, height: 60, fit: [90, 60] });
      doc.x = 150;
      doc.y = headerTop;
    } catch (error) {
      console.error("[render-invoice] couldn't draw company logo", error);
    }
  }

  doc.fontSize(20).fillColor("#000000").text(input.company.legalName, { continued: false });
  doc.fontSize(10).fillColor("#555555");
  doc.text(input.company.address);
  doc.text(`${input.company.phone} · ${input.company.email}`);
  if (input.company.gstNumber) doc.text(`GSTIN: ${input.company.gstNumber}`);
  doc.x = 50;
  doc.moveDown(1.5);

  // Never hardcode "TAX INVOICE" — a Proforma is always labeled as such
  // regardless of GST, and a real invoice only calls itself "TAX INVOICE"
  // when GST actually applies (client's own locked "GST OFF -> non-GST
  // invoice" rule, see tax-fee-config.ts) — fixes a real bug where every
  // invoice used to say "TAX INVOICE" even at 0% GST.
  const heading = input.isProforma ? "PROFORMA INVOICE" : input.gstAmount > 0 ? "TAX INVOICE" : "INVOICE";
  doc.fillColor("#000000").fontSize(16).text(heading, { align: "right" });
  doc.fontSize(10).fillColor("#555555");
  doc.text(`Invoice #: ${input.invoiceNumber}`, { align: "right" });
  doc.text(`Date: ${input.issuedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, { align: "right" });
  doc.moveDown(1.5);

  doc.fillColor("#000000").fontSize(11).text("Billed To", { underline: true });
  doc.fontSize(10).fillColor("#333333");
  doc.text(input.customerName);
  doc.text(input.customerMobile);
  if (input.customerEmail) doc.text(input.customerEmail);
  doc.moveDown(0.5);
  if (input.bookingId) doc.text(`Booking: ${input.bookingId}`);
  doc.text(`Lead Reference: ${input.leadReference}`);
  doc.moveDown(1.5);

  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 300;
  const col3 = 370;
  const col4 = 420;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
  doc.text("Description", col1, tableTop);
  doc.text("SAC", col2, tableTop);
  doc.text("Qty", col3, tableTop);
  doc.text("Rate", col4, tableTop, { align: "right", width: 75 });
  doc.font("Helvetica");
  doc.moveTo(50, doc.y + 14).lineTo(545, doc.y + 14).strokeColor("#cccccc").stroke();
  doc.moveDown(1.2);

  const fmt = (value: number) => formatCurrency(value, input.company.currencyCode);

  const itemY = doc.y;
  doc.fontSize(9).fillColor("#333333");
  doc.text(input.description, col1, itemY, { width: 240 });
  doc.text(input.company.sacCode ?? "—", col2, itemY);
  doc.text("1", col3, itemY);
  doc.text(fmt(input.baseFare), col4, itemY, { align: "right", width: 75 });
  doc.moveDown(1);

  doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor("#cccccc").stroke();
  doc.moveDown(0.8);

  const amountCol = 420;
  const row = (label: string, value: string) => {
    const y = doc.y;
    doc.fontSize(10).fillColor("#333333").text(label, col1, y);
    doc.text(value, amountCol, y, { align: "right", width: 75 });
    doc.moveDown(0.6);
  };

  if (input.couponDiscount > 0) {
    row(`Discount (${input.couponCode ?? "coupon"})`, `- ${fmt(input.couponDiscount)}`);
  }
  const taxableValue = input.baseFare - input.couponDiscount;
  row("Taxable Value", fmt(taxableValue));
  if (input.gstAmount > 0) {
    row(`GST @ ${input.gstRatePercent.toFixed(2)}%`, fmt(input.gstAmount));
  }
  if (input.gatewayFee > 0) {
    row("Payment Gateway Fee", fmt(input.gatewayFee));
  }

  doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor("#cccccc").stroke();
  doc.moveDown(0.6);
  const totalY = doc.y;
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#000000").text("Total", col1, totalY);
  doc.text(fmt(input.total), amountCol, totalY, { align: "right", width: 75 });
  doc.font("Helvetica");
  doc.moveDown(2);

  if (input.isProforma) {
    doc.fontSize(8).fillColor("#999999").text(
      "This is a Proforma Invoice for reference only — not a demand for payment or a valid Tax Invoice. GST (if applicable) is computed at the time of actual payment.",
      50,
      doc.y,
      { align: "center", width: 495 }
    );
    doc.moveDown(1);
  }

  drawBankDetails(doc, input.company);
  if (input.company.termsAndNotes) {
    doc.fontSize(8).fillColor("#777777").text(input.company.termsAndNotes, 50, doc.y, { width: 495 });
    doc.moveDown(1);
  }
  drawSignatory(doc, input.company);

  doc.end();
  return done;
}

export interface PaymentInvoice {
  pdf: Buffer;
  invoiceNumber: string;
  bookingId: string;
  total: number;
}

/**
 * Fetches a SUCCESS payment's full context and renders its invoice (TAX or
 * plain INVOICE depending on whether GST was actually charged — see
 * renderInvoicePdf's heading logic). Returns null for a missing or
 * non-SUCCESS payment — callers that need to tell those two cases apart
 * (the download route returns 404 vs. 409) fetch the payment themselves
 * first; this is for callers (the email trigger) that already know the
 * payment just succeeded.
 */
export async function buildInvoicePdfForPayment(paymentId: string): Promise<PaymentInvoice | null> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { customer: true, lead: true } } },
  });
  if (!payment || payment.status !== "SUCCESS") return null;

  const baseFare = Number(payment.amount);
  const couponDiscount = Number(payment.couponDiscount ?? 0);
  const netAmount = baseFare - couponDiscount;
  const gstAmount = Number(payment.gstAmount);
  const gatewayFee = Number(payment.gatewayFee);
  // Total reflects what was actually charged: base minus the coupon, plus GST/gateway (both already computed on the discounted amount at payment-creation time).
  const total = netAmount + gstAmount + gatewayFee;
  // GST rate is reconstructed against netAmount (what it was actually computed on), not baseFare — otherwise a coupon would make the displayed rate look lower than it really was.
  const gstRatePercent = netAmount > 0 ? (gstAmount / netAmount) * 100 : 0;
  const invoiceNumber = `INV-${payment.id.slice(-8).toUpperCase()}`;

  const company = await getInvoiceCompanyDetails();

  const pdf = await renderInvoicePdf({
    invoiceNumber,
    issuedAt: payment.updatedAt,
    bookingId: payment.booking.bookingId,
    leadReference: formatLeadReference(payment.booking.lead.serviceType, payment.booking.leadId),
    customerName: payment.booking.customer.name,
    customerMobile: payment.booking.customer.mobile,
    customerEmail: payment.booking.customer.email,
    description: `${payment.booking.lead.serviceType.replaceAll("_", " ")} — Service Fee`,
    baseFare,
    couponCode: payment.couponCode,
    couponDiscount,
    gstAmount,
    gstRatePercent,
    gatewayFee,
    total,
    company,
  });

  return { pdf, invoiceNumber, bookingId: payment.booking.bookingId, total };
}

export interface QuotationInvoice {
  pdf: Buffer;
  invoiceNumber: string;
  total: number;
}

/**
 * Builds a Proforma Invoice from a Quotation — a pre-payment estimate, not
 * a record of money actually collected. No GST/gateway-fee line: a
 * Quotation has no computed GST today (that only happens at Payment
 * creation via getTaxFeeRates()), so a Proforma shows the selling price
 * and coupon discount only. Never exposes vendorCost/margin (same
 * never-trust/never-show-the-customer rule as everywhere else this pair
 * appears). Returns null only if the quotation itself doesn't exist — an
 * unselected/expired quotation can still get a Proforma (it's just an
 * estimate), unlike a Payment invoice which requires SUCCESS.
 */
export async function buildInvoicePdfForQuotation(quotationId: string): Promise<QuotationInvoice | null> {
  const quotation = await db.quotation.findUnique({
    where: { id: quotationId },
    include: { lead: { include: { customer: true } } },
  });
  if (!quotation) return null;

  const sellingPrice = Number(quotation.sellingPrice);
  const couponDiscount = Number(quotation.couponDiscount ?? 0);
  const total = sellingPrice - couponDiscount;
  const invoiceNumber = `PF-${quotation.id.slice(-8).toUpperCase()}`;

  const company = await getInvoiceCompanyDetails();

  const pdf = await renderInvoicePdf({
    isProforma: true,
    invoiceNumber,
    issuedAt: quotation.createdAt,
    bookingId: null,
    leadReference: formatLeadReference(quotation.lead.serviceType, quotation.leadId),
    customerName: quotation.lead.customer.name,
    customerMobile: quotation.lead.customer.mobile,
    customerEmail: quotation.lead.customer.email,
    description: `${quotation.lead.serviceType.replaceAll("_", " ")} — Service Fee (Estimate)`,
    baseFare: sellingPrice,
    couponCode: quotation.couponCode,
    couponDiscount,
    gstAmount: 0,
    gstRatePercent: 0,
    gatewayFee: 0,
    total,
    company,
  });

  return { pdf, invoiceNumber, total };
}
