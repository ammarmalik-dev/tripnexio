import { gstinStateCode, gstStateName } from "../gst/india-states";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { formatCurrency } from "../format-currency";
import { siteConfig } from "../site-config";
import { amountInWords } from "./amount-in-words";
import {
  buildPaymentInvoiceDocument,
  buildQuotationInvoiceDocument,
  type InvoiceDocument,
  type InvoiceDocumentLine,
} from "./invoice-document";

export { serviceSacCode } from "./invoice-document";

/** @deprecated Kept for any external caller expecting the old fixed-INR formatter — renderInvoicePdf itself now uses formatCurrency(value, company.currencyCode) so amounts respect the Admin-configured currency (Step 45). */
export function money(value: number): string {
  return formatCurrency(value, "INR");
}

/** Resolved InvoiceConfig + effective company identity (Step 45's SystemConfig overrides merged over site-config.ts), with logo/signature already read into Buffers — see company-config.ts. */
/**
 * How the invoice GST is split: CGST + SGST (half each) when the place of
 * supply is the company's own state (the first two digits of its GSTIN),
 * IGST for another state or outside India, and a single "GST" row when
 * either state isn't known.
 */
export function gstSplit(invoice: { gstAmount: number; gstRatePercent: number; customer: { stateCode: string | null }; company: { gstNumber: string | null } }) {
  const companyState = gstinStateCode(invoice.company.gstNumber);
  const customerState = invoice.customer.stateCode;
  if (!companyState || !customerState) return [{ label: "GST", rate: invoice.gstRatePercent, amount: invoice.gstAmount }];
  if (companyState === customerState) {
    const half = Math.round((invoice.gstAmount / 2) * 100) / 100;
    return [
      { label: "CGST", rate: invoice.gstRatePercent / 2, amount: half },
      { label: "SGST", rate: invoice.gstRatePercent / 2, amount: Math.round((invoice.gstAmount - half) * 100) / 100 },
    ];
  }
  return [{ label: "IGST", rate: invoice.gstRatePercent, amount: invoice.gstAmount }];
}

export interface InvoiceCompanyDetails {
  legalName: string;
  address: string;
  phone: string;
  email: string;
  currencyCode: string;
  gstNumber: string | null;
  /** Client testing 2026-10-09 (D1) — WhatsApp shown separately from the phone. */
  whatsapp?: string | null;
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

// ---------------------------------------------------------------------------
// Client corrections 2026-10-05 — the invoice layout from the client's sample
// (client-message/new-doc-from-client): wordmark + company block, navy title
// band, Bill To / Booking Details cards, a line table with Government Fee /
// Service Fee / Taxable / GST columns, Tax Summary, Total Summary (navy Grand
// Total bar), Amount in Words, Notes & Terms, "Scan to verify" QR, signatory
// and a navy footer. Brand colours are the four locked --tn-* values.
// ---------------------------------------------------------------------------

const NAVY = "#182A4D";
const BLUE = "#3E6FDB";
const INK = "#111318";
const MUTED = "#5B6478";
const PANEL = "#EEF3FC";
const BORDER = "#D6E0F2";
const GREEN = "#1E8E3E";
const PAGE_W = 595.28;
const M = 28;
const W = PAGE_W - M * 2;

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const DEFAULT_NOTES = [
  "Govt./airline/vendor fees are shown separately and are not subject to GST.",
  "Service fees are subject to applicable GST.",
  "GST treatment of government/third-party charges is based on the configured tax treatment and applicable law.",
  "Refunds/cancellations are subject to the applicable service refund policy.",
  "This is a system-generated invoice and does not require a physical signature where legally permitted.",
];

function registerFonts(doc: PDFKit.PDFDocument): { regular: string; semi: string; bold: string } {
  try {
    doc.registerFont("TN-Regular", path.join(FONT_DIR, "NotoSans-Regular.ttf"));
    doc.registerFont("TN-Semi", path.join(FONT_DIR, "NotoSans-SemiBold.ttf"));
    doc.registerFont("TN-Bold", path.join(FONT_DIR, "NotoSans-Bold.ttf"));
    return { regular: "TN-Regular", semi: "TN-Semi", bold: "TN-Bold" };
  } catch (error) {
    // Without the font files "₹" can't be drawn; amounts then fall back to the currency code.
    console.error("[render-invoice] couldn't load invoice fonts", error);
    return { regular: "Helvetica", semi: "Helvetica-Bold", bold: "Helvetica-Bold" };
  }
}

function fmtDate(value: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export async function renderInvoicePdf(invoice: InvoiceDocument): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true, info: { Title: `${invoice.title} ${invoice.invoiceNumber}`, Author: invoice.company.legalName } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const F = registerFonts(doc);
  const hasRupee = F.regular !== "Helvetica";
  const currency = invoice.company.currencyCode;
  const num = (value: number) => value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (value: number) => (hasRupee ? formatCurrency(value, currency) : `${currency} ${num(value)}`);
  const text = (value: string, x: number, y: number, opts: PDFKit.Mixins.TextOptions & { font?: string; size?: number; color?: string } = {}) => {
    const { font = F.regular, size = 8.5, color = INK, ...rest } = opts;
    doc.font(font).fontSize(size).fillColor(color).text(value, x, y, { lineBreak: rest.width !== undefined, ...rest });
  };

  // ---- Header: logo / wordmark + company block
  let y = M;
  if (invoice.company.logoBuffer) {
    // Client testing 2026-10-09 (G1) — the uploaded logo, then the name and tagline to its right.
    try {
      doc.image(invoice.company.logoBuffer, M, y, { fit: [52, 52] });
    } catch (error) {
      console.error("[render-invoice] couldn't draw company logo", error);
    }
    doc.font(F.bold).fontSize(26).fillColor(NAVY).text("Trip", M + 62, y + 2, { continued: true, lineBreak: false }).fillColor(BLUE).text("Nexio", { lineBreak: false });
  } else {
    doc.font(F.bold).fontSize(30).fillColor(NAVY).text("Trip", M, y - 4, { continued: true, lineBreak: false }).fillColor(BLUE).text("Nexio", { lineBreak: false });
  }
  if (invoice.company.logoBuffer) text("Travel Made Easy with TripNexio.", M + 62, y + 34, { font: F.semi, size: 10, color: NAVY });
  else text("Travel Made Easy with TripNexio.", M, y + 50, { font: F.semi, size: 10, color: NAVY });

  const companyX = M + 262;
  doc.moveTo(companyX - 14, y + 2).lineTo(companyX - 14, y + 70).strokeColor(BORDER).lineWidth(1).stroke();
  text(invoice.company.legalName, companyX, y, { font: F.bold, size: 11, color: NAVY });
  let cy = y + 16;
  if (invoice.company.address) {
    text(invoice.company.address, companyX, cy, { size: 8, color: MUTED, width: W - (companyX - M) });
    cy = doc.y + 3;
  }
  for (const [label, value] of [
    ["GSTIN", invoice.company.gstNumber],
    ["Email", invoice.company.email],
    ["Phone", invoice.company.phone],
    ["WhatsApp", invoice.company.whatsapp && invoice.company.whatsapp !== invoice.company.phone ? invoice.company.whatsapp : null],
  ] as const) {
    if (!value) continue;
    text(`${label}:`, companyX, cy, { font: F.semi, size: 8 });
    text(value, companyX + 52, cy, { size: 8 });
    cy += 12;
  }
  y = Math.max(y + 78, cy + 6);

  // ---- Title band
  const bandH = 64;
  doc.roundedRect(M, y, W, bandH, 6).fill(NAVY);
  text(invoice.title, M + 16, y + (invoice.title.length > 12 ? 22 : 18), { font: F.bold, size: invoice.title.length > 12 ? 17 : 24, color: "#FFFFFF" });

  const midX = M + 236;
  const rightX = M + 392;
  const bandRow = (label: string, value: string, x: number, rowY: number, valueX: number) => {
    text(label, x, rowY, { font: F.semi, size: 8.5, color: "#FFFFFF" });
    // One line only (pdfkit applies the ellipsis only with a height); the full label is in Booking Details.
    text(value, valueX, rowY, { size: 8.5, color: "#FFFFFF", width: PAGE_W - M - valueX - 8, height: 11, ellipsis: true });
  };
  bandRow("Invoice No.:", invoice.invoiceNumber, midX, y + 18, midX + 66);
  bandRow("Invoice Date:", fmtDate(invoice.issuedAt), midX, y + 34, midX + 66);
  doc.moveTo(rightX - 10, y + 12).lineTo(rightX - 10, y + bandH - 12).strokeColor("#3A4D73").stroke();
  bandRow(invoice.bookingId ? "Booking ID:" : "Reference:", invoice.bookingId ?? invoice.leadReference, rightX, y + 12, rightX + 66);
  bandRow("Service:", invoice.serviceLabel.split(" – ")[0], rightX, y + 26, rightX + 66);
  bandRow("Status:", invoice.paymentStatus, rightX, y + 40, rightX + 66);
  y += bandH + 12;

  // ---- Bill To / Booking Details cards
  const cardW = (W - 12) / 2;
  const drawCard = (x: number, title: string, rows: [string, string][]) => {
    const h = 26 + rows.length * 13 + 8;
    doc.roundedRect(x, y, cardW, h, 6).lineWidth(0.8).strokeColor(BORDER).stroke();
    doc.roundedRect(x, y, cardW, 22, 6).fill(PANEL);
    doc.rect(x, y + 14, cardW, 8).fill(PANEL);
    doc.roundedRect(x + 8, y + 5, 12, 12, 3).fill(BLUE);
    text(title, x + 26, y + 6, { font: F.bold, size: 9.5, color: NAVY });
    rows.forEach(([label, value], index) => {
      const rowY = y + 28 + index * 13;
      text(label, x + 10, rowY, { size: 8.5, color: MUTED });
      text(":", x + 92, rowY, { size: 8.5, color: MUTED });
      text(value || "—", x + 100, rowY, { size: 8.5, width: cardW - 108, ellipsis: true });
    });
    return h;
  };
  // Client corrections 2026-10-05 (invoice sample) — address, state, state code and GSTIN when collected.
  const stateName = gstStateName(invoice.customer.stateCode);
  const billRows: [string, string][] = [
    ["Customer Name", invoice.customer.name],
    ["Mobile", invoice.customer.mobile],
    ...(invoice.customer.email ? ([["Email", invoice.customer.email]] as [string, string][]) : []),
    ...(invoice.customer.address ? ([["Address", invoice.customer.address]] as [string, string][]) : []),
    ...(stateName && invoice.customer.stateCode
      ? ([
          ["State", stateName],
          ["State Code", invoice.customer.stateCode],
        ] as [string, string][])
      : []),
    ["GSTIN", invoice.customer.gstin ?? "NA (Individual)"],
  ];
  const bookingRows: [string, string][] = [
    ...(invoice.bookingId ? ([["Booking ID", invoice.bookingId]] as [string, string][]) : ([["Reference", invoice.leadReference]] as [string, string][])),
    ["Service", invoice.serviceLabel],
    ...(invoice.subService ? ([["Sub Service", invoice.subService]] as [string, string][]) : []),
    ...(invoice.paxCount ? ([["Pax Count", String(invoice.paxCount)]] as [string, string][]) : []),
    ...(invoice.bookingDate ? ([["Booking Date", fmtDate(invoice.bookingDate)]] as [string, string][]) : []),
    ...(invoice.travelDate ? ([["Travel Date", fmtDate(invoice.travelDate)]] as [string, string][]) : []),
    ...(stateName ? ([["Place of Supply", `${stateName} (${invoice.customer.stateCode})`]] as [string, string][]) : []),
    ["Customer Type", invoice.customer.gstin ? "Business" : "Individual"],
  ];
  const cardH = Math.max(drawCard(M, "Bill To (Customer Details)", billRows), drawCard(M + cardW + 12, "Booking Details", bookingRows));
  y += cardH + 12;

  // ---- Line table
  const cols = [
    { key: "#", w: 18, align: "center" as const },
    { key: "Description", w: 128, align: "left" as const },
    { key: "SAC", w: 44, align: "center" as const },
    { key: "Qty", w: 26, align: "center" as const },
    { key: `Govt./Airline/ Vendor Fee`, w: 56, align: "right" as const },
    { key: `Service Fee`, w: 52, align: "right" as const },
    { key: `Taxable Value`, w: 56, align: "right" as const },
    { key: "GST %", w: 32, align: "right" as const },
    { key: "GST Amount", w: 52, align: "right" as const },
    { key: "Total Amount", w: W - 464, align: "right" as const },
  ];
  const headH = 26;
  doc.roundedRect(M, y, W, headH, 5).fill(PANEL);
  let x = M;
  for (const col of cols) {
    text(col.key, x + 3, y + 5, { font: F.bold, size: 7.5, color: NAVY, width: col.w - 6, align: col.align });
    x += col.w;
  }
  y += headH;
  const lineGst = (line: InvoiceDocumentLine) => (line.serviceFee > 0 ? (line.gstAmount / line.serviceFee) * 100 : 0);
  invoice.lines.forEach((line, index) => {
    const cells = [
      String(index + 1),
      line.description,
      line.sac ?? "—",
      String(line.quantity),
      line.governmentFee > 0 ? num(line.governmentFee) : "-",
      num(line.serviceFee),
      num(line.serviceFee),
      `${Math.round(lineGst(line) * 100) / 100}%`,
      num(line.gstAmount),
      num(line.governmentFee + line.serviceFee + line.gstAmount),
    ];
    doc.font(F.regular).fontSize(8);
    const rowH = Math.max(22, doc.heightOfString(line.description, { width: cols[1].w - 6 }) + 10);
    if (y + rowH > 780) {
      doc.addPage();
      y = M;
    }
    let cx = M;
    cells.forEach((cell, cellIndex) => {
      text(cell, cx + 3, y + 6, { font: cellIndex === 9 ? F.semi : F.regular, size: 8, width: cols[cellIndex].w - 6, align: cols[cellIndex].align });
      cx += cols[cellIndex].w;
    });
    y += rowH;
    doc.moveTo(M, y).lineTo(M + W, y).strokeColor(BORDER).lineWidth(0.6).stroke();
  });
  y += 12;
  if (y > 560) {
    doc.addPage();
    y = M;
  }

  // ---- Tax Summary + Amount in Words (left), Total Summary (right)
  const leftW = 300;
  const rightCol = M + leftW + 12;
  const rightW = W - leftW - 12;
  const sectionTop = y;

  doc.roundedRect(M, y, leftW, 22, 5).fill(PANEL);
  text("Tax Summary", M + 26, y + 6, { font: F.bold, size: 9.5, color: NAVY });
  doc.roundedRect(M + 8, y + 5, 12, 12, 3).fill(BLUE);
  y += 28;
  const taxable = Math.max(0, invoice.lines.reduce((sum, line) => sum + line.serviceFee, 0) - invoice.couponDiscount);
  if (invoice.gstAmount > 0) {
    text("Tax Type", M + 8, y, { font: F.semi, size: 8, color: MUTED });
    text("Taxable Value", M + 90, y, { font: F.semi, size: 8, color: MUTED });
    text("Rate", M + 180, y, { font: F.semi, size: 8, color: MUTED });
    text("Amount", M + 220, y, { font: F.semi, size: 8, color: MUTED, width: 72, align: "right" });
    y += 14;
    // Same state as the company (its GSTIN's state code) = CGST + SGST halves; another state or abroad = IGST.
    for (const row of gstSplit(invoice)) {
      text(row.label, M + 8, y, { size: 8.5 });
      text(num(taxable), M + 90, y, { size: 8.5 });
      text(`${row.rate}%`, M + 180, y, { size: 8.5 });
      text(num(row.amount), M + 220, y, { size: 8.5, width: 72, align: "right" });
      y += 14;
    }
    doc.rect(M, y, leftW, 18).fill(PANEL);
    text("Total GST", M + 8, y + 4, { font: F.bold, size: 8.5, color: NAVY });
    text(num(invoice.gstAmount), M + 220, y + 4, { font: F.bold, size: 8.5, color: NAVY, width: 72, align: "right" });
    y += 26;
  } else {
    text(
      invoice.title === "PROFORMA INVOICE" ? "GST, if applicable, is added when the payment is made." : "No GST is charged on this invoice.",
      M + 8,
      y,
      { size: 8.5, color: MUTED, width: leftW - 16 }
    );
    y = doc.y + 10;
  }
  doc.roundedRect(M, y, leftW, 40, 5).fill(PANEL);
  text("Amount in Words:", M + 10, y + 6, { font: F.semi, size: 8, color: BLUE });
  text(amountInWords(invoice.grandTotal, currency), M + 10, y + 19, { size: 8.5, width: leftW - 20 });
  y += 48;
  const bank = invoice.company;
  if (bank.bankAccountNumber || bank.bankName) {
    text("Bank Details", M, y, { font: F.semi, size: 8, color: NAVY });
    y += 11;
    const bankLines = [
      bank.bankAccountName ? `Account Name: ${bank.bankAccountName}` : null,
      bank.bankAccountNumber ? `Account No.: ${bank.bankAccountNumber}` : null,
      bank.bankIfscCode ? `IFSC: ${bank.bankIfscCode}` : null,
      bank.bankName ? `Bank: ${bank.bankName}${bank.bankBranch ? `, ${bank.bankBranch}` : ""}` : null,
    ].filter((line): line is string => line !== null);
    for (const line of bankLines) {
      text(line, M, y, { size: 8, color: MUTED });
      y += 11;
    }
    y += 4;
  }
  const leftBottom = y;

  // Total summary
  let ry = sectionTop;
  doc.roundedRect(rightCol, ry, rightW, 22, 5).fill(PANEL);
  doc.roundedRect(rightCol + 8, ry + 5, 12, 12, 3).fill(BLUE);
  text("Total Summary", rightCol + 26, ry + 6, { font: F.bold, size: 9.5, color: NAVY });
  ry += 28;
  const governmentTotal = invoice.lines.reduce((sum, line) => sum + line.governmentFee, 0);
  const serviceTotal = invoice.lines.reduce((sum, line) => sum + line.serviceFee, 0);
  const summaryRow = (label: string, value: string, color = INK) => {
    text(label, rightCol + 8, ry, { size: 8.5, color: MUTED });
    text(value, rightCol + 8, ry, { size: 8.5, color, width: rightW - 16, align: "right" });
    ry += 13;
    doc.moveTo(rightCol, ry - 2).lineTo(rightCol + rightW, ry - 2).strokeColor(BORDER).lineWidth(0.4).stroke();
  };
  summaryRow("Total Govt./Airline/Vendor Fee", money(governmentTotal));
  summaryRow("Total Service Fee", money(serviceTotal));
  summaryRow(`Discount${invoice.couponCode ? ` (${invoice.couponCode})` : ""}`, `- ${money(invoice.couponDiscount)}`, GREEN);
  summaryRow("Taxable Value", money(taxable));
  summaryRow("Total GST", money(invoice.gstAmount));
  if (invoice.gatewayFee > 0) summaryRow("Payment Gateway Fee", money(invoice.gatewayFee));
  ry += 2;
  doc.roundedRect(rightCol, ry, rightW, 24, 4).fill(NAVY);
  text("Grand Total", rightCol + 10, ry + 6, { font: F.bold, size: 11, color: "#FFFFFF" });
  text(money(invoice.grandTotal), rightCol + 10, ry + 6, { font: F.bold, size: 11, color: "#FFFFFF", width: rightW - 20, align: "right" });
  ry += 30;
  summaryRow("Amount Paid", money(invoice.amountPaid), GREEN);
  summaryRow("Balance Due", money(invoice.balanceDue));
  y = Math.max(leftBottom, ry) + 8;
  if (y > 640) {
    doc.addPage();
    y = M;
  }

  // ---- Notes & Terms | QR | Signatory
  const notesW = 300;
  const notes = invoice.company.termsAndNotes?.trim()
    ? invoice.company.termsAndNotes
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : DEFAULT_NOTES;
  const notesTop = y;
  doc.font(F.regular).fontSize(7.5);
  const notesBodyH = notes.reduce((sum, note, index) => sum + doc.heightOfString(`${index + 1}. ${note}`, { width: notesW - 20 }) + 2, 0);
  doc.roundedRect(M, y, notesW, 22 + notesBodyH + 8, 5).fill(PANEL);
  text("Notes & Terms", M + 10, y + 6, { font: F.bold, size: 9, color: NAVY });
  let ny = y + 22;
  notes.forEach((note, index) => {
    text(`${index + 1}. ${note}`, M + 10, ny, { size: 7.5, color: INK, width: notesW - 20 });
    ny = doc.y + 2;
  });
  const notesBottom = notesTop + 22 + notesBodyH + 8;

  const qrX = M + notesW + 12;
  if (invoice.verifyUrl) {
    try {
      const qr = await QRCode.toBuffer(invoice.verifyUrl, { margin: 0, width: 160, color: { dark: INK, light: "#FFFFFF" } });
      doc.roundedRect(qrX, notesTop, 118, 64, 5).fill(PANEL);
      doc.image(qr, qrX + 6, notesTop + 6, { width: 52, height: 52 });
      text("Scan to verify", qrX + 62, notesTop + 8, { font: F.bold, size: 7, color: NAVY, width: 54 });
      text(invoice.invoiceNumber, qrX + 62, notesTop + 22, { size: 6, color: MUTED, width: 54 });
      text(fmtDate(invoice.issuedAt), qrX + 62, notesTop + 46, { size: 6, color: MUTED, width: 54 });
    } catch (error) {
      console.error("[render-invoice] couldn't draw the verify QR", error);
    }
  }

  const signX = M + W - 100;
  text(`For ${invoice.company.legalName}`, signX, notesTop, { font: F.bold, size: 8, color: NAVY, width: 100, align: "center" });
  if (invoice.company.signatureBuffer) {
    try {
      doc.image(invoice.company.signatureBuffer, signX + 12, notesTop + 16, { fit: [76, 34], align: "center" });
    } catch (error) {
      console.error("[render-invoice] couldn't draw signature image", error);
    }
  }
  doc.moveTo(signX + 6, notesTop + 52).lineTo(signX + 96, notesTop + 52).strokeColor(INK).lineWidth(0.6).stroke();
  text(invoice.company.signatoryName ?? "Authorized Signatory", signX, notesTop + 56, { size: 8, width: 100, align: "center" });
  if (invoice.company.signatoryName) {
    text(invoice.company.signatoryTitle ?? "Authorized Signatory", signX, notesTop + 67, { size: 7, color: MUTED, width: 100, align: "center" });
  }

  // ---- Footer
  const footerY = Math.max(notesBottom + 14, 772);
  const contact = [siteConfig.url.replace(/^https?:\/\//, ""), invoice.company.email, invoice.company.phone].filter(Boolean).join("   |   ");
  text(contact, M, footerY - 18, { size: 8.5, color: NAVY, width: W, align: "center" });
  doc.rect(0, footerY, PAGE_W, 842 - footerY).fill(NAVY);
  text("Travel Made Easy with TripNexio.", 0, footerY + 10, { font: F.semi, size: 8.5, color: "#FFFFFF", width: PAGE_W, align: "center" });

  if (invoice.paymentStatus === "Cancelled") {
    // Client testing 2026-10-09 (E5) — the booking was cancelled / fully refunded: stamp the first page.
    doc.switchToPage(0);
    doc.save();
    doc.opacity(0.22);
    doc.rotate(-24, { origin: [PAGE_W / 2, 420] });
    text("CANCELLED", PAGE_W / 2 - 300, 385, { font: F.bold, size: 72, color: "#D1435B", width: 600, align: "center" });
    doc.restore();
  }
  doc.end();
  return done;
}

export interface PaymentInvoice {
  pdf: Buffer;
  invoiceNumber: string;
  bookingId: string;
  total: number;
}

/** The PDF for a successful payment (download routes and the PAYMENT_RECEIVED email attachment). Null unless the payment succeeded. */
export async function buildInvoicePdfForPayment(paymentId: string): Promise<PaymentInvoice | null> {
  const invoice = await buildPaymentInvoiceDocument(paymentId);
  if (!invoice) return null;
  return { pdf: await renderInvoicePdf(invoice), invoiceNumber: invoice.invoiceNumber, bookingId: invoice.bookingId ?? "", total: invoice.grandTotal };
}

export interface QuotationInvoice {
  pdf: Buffer;
  invoiceNumber: string;
  total: number;
}

/** A quotation's Proforma Invoice (same layout; never shows vendor cost or margin). */
export async function buildInvoicePdfForQuotation(quotationId: string): Promise<QuotationInvoice | null> {
  const invoice = await buildQuotationInvoiceDocument(quotationId);
  if (!invoice) return null;
  return { pdf: await renderInvoicePdf(invoice), invoiceNumber: invoice.invoiceNumber, total: invoice.grandTotal };
}
