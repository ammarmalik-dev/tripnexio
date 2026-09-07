import PDFDocument from "pdfkit";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatLeadReference } from "@/lib/leads/reference";
import { siteConfig } from "@/lib/site-config";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function money(value: number): string {
  return `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function renderInvoicePdf(input: {
  invoiceNumber: string;
  issuedAt: Date;
  bookingId: string;
  leadReference: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string | null;
  baseFare: number;
  gstAmount: number;
  gstRatePercent: number;
  gatewayFee: number;
  total: number;
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(20).text(siteConfig.legalName, { continued: false });
  doc.fontSize(10).fillColor("#555555");
  doc.text(siteConfig.contact.address);
  doc.text(`${siteConfig.contact.phone} · ${siteConfig.contact.email}`);
  doc.moveDown(1.5);

  doc.fillColor("#000000").fontSize(16).text("TAX INVOICE", { align: "right" });
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
  doc.text(`Booking: ${input.bookingId}`);
  doc.text(`Lead Reference: ${input.leadReference}`);
  doc.moveDown(1.5);

  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 420;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000");
  doc.text("Description", col1, tableTop);
  doc.text("Amount", col2, tableTop);
  doc.font("Helvetica");
  doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor("#cccccc").stroke();
  doc.moveDown(0.8);

  const row = (label: string, value: string) => {
    const y = doc.y;
    doc.fillColor("#333333").text(label, col1, y);
    doc.text(value, col2, y);
    doc.moveDown(0.6);
  };

  row("Base Fare (Service Fee)", money(input.baseFare));
  row(`GST @ ${input.gstRatePercent.toFixed(2)}% (tax on service fee)`, money(input.gstAmount));
  row("Payment Gateway Fee", money(input.gatewayFee));

  doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor("#cccccc").stroke();
  doc.moveDown(0.6);
  const totalY = doc.y;
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#000000").text("Total", col1, totalY);
  doc.text(money(input.total), col2, totalY);
  doc.font("Helvetica");
  doc.moveDown(2);

  doc.fontSize(8).fillColor("#999999").text("This is a computer-generated invoice and does not require a signature.", 50, doc.y, {
    align: "center",
    width: 495,
  });

  doc.end();
  return done;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const payment = await db.payment.findUnique({
    where: { id },
    include: { booking: { include: { customer: true, lead: true } } },
  });
  if (!payment) return jsonError(404, "Payment not found.");
  if (payment.status !== "SUCCESS") {
    return jsonError(409, "An invoice is only available for a successful payment.");
  }

  const baseFare = Number(payment.amount);
  const gstAmount = Number(payment.gstAmount);
  const gatewayFee = Number(payment.gatewayFee);
  const total = baseFare + gstAmount + gatewayFee;
  // Derived from what was actually charged on this payment, not today's
  // config — a rate change later shouldn't rewrite a historical invoice.
  const gstRatePercent = baseFare > 0 ? (gstAmount / baseFare) * 100 : 0;

  const pdf = await renderInvoicePdf({
    invoiceNumber: `INV-${payment.id.slice(-8).toUpperCase()}`,
    issuedAt: payment.updatedAt,
    bookingId: payment.booking.bookingId,
    leadReference: formatLeadReference(payment.booking.lead.serviceType, payment.booking.leadId),
    customerName: payment.booking.customer.name,
    customerMobile: payment.booking.customer.mobile,
    customerEmail: payment.booking.customer.email,
    baseFare,
    gstAmount,
    gstRatePercent,
    gatewayFee,
    total,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${payment.booking.bookingId}.pdf"`,
    },
  });
}
