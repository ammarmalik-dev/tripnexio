import PDFDocument from "pdfkit";
import { PDF_BRAND } from "../brand/pdf-tokens";
import { siteConfig } from "../site-config";
import type { InvoiceCompanyDetails } from "../invoices/render-invoice";
import { customerBlockRows, OPERATIONAL_BLOCK_TITLE, type OperationalBlock } from "./operational";

export interface VisaChangePackageInput {
  bookingId: string;
  leadReference: string;
  customerName: string;
  customerMobile: string;
  passengers: { fullName: string; passportNumber: string | null }[];
  block: OperationalBlock;
  company: InvoiceCompanyDetails;
  generatedAt: Date;
}

/**
 * P14 — the Visa Change package PDF (Visa_Change.md §21): every field for
 * the chosen method (A2A: entry/exit airport, airline, flight, date, time,
 * reporting time; Border: border, pickup location/person/contact, reporting
 * and travel time, drop location, bus/operator), the passengers, the
 * Booking ID and the instructions staff entered. Never vendor, cost or
 * price. Brand-styled from PDF_BRAND; pure renderer (no I/O).
 */
export async function renderVisaChangePackagePdf(input: VisaChangePackageInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const companyName = input.company.legalName?.trim() || siteConfig.name;
  const contactLine = [input.company.phone, input.company.email].filter((part) => part && part.trim()).join(" · ");
  const pageWidth = doc.page.width;
  const left = 50;
  const contentWidth = pageWidth - 100;

  // Header band
  doc.rect(0, 0, pageWidth, 96).fill(PDF_BRAND.deepNavy);
  let textLeft = left;
  if (input.company.logoBuffer) {
    try {
      // Light tile so a dark logo stays visible on the navy band.
      doc.roundedRect(left, 16, 64, 64, 6).fill(PDF_BRAND.warmWhite);
      doc.image(input.company.logoBuffer, left + 4, 20, { fit: [56, 56], align: "center", valign: "center" });
      textLeft = left + 76;
    } catch (error) {
      console.error("[visa-change/package-pdf] couldn't draw company logo", error);
    }
  }
  doc.fillColor(PDF_BRAND.warmWhite).font("Helvetica-Bold").fontSize(18).text(companyName, textLeft, 26, { width: contentWidth - (textLeft - left) });
  if (contactLine) doc.font("Helvetica").fontSize(9).fillColor(PDF_BRAND.warmWhite).text(contactLine, textLeft, 52);
  doc.rect(0, 96, pageWidth, 4).fill(PDF_BRAND.electricBlue);

  // Title
  doc.fillColor(PDF_BRAND.deepNavy).font("Helvetica-Bold").fontSize(16).text("Visa Change Package", left, 124);
  doc.font("Helvetica").fontSize(11).fillColor(PDF_BRAND.electricBlue).text(OPERATIONAL_BLOCK_TITLE[input.block.kind], left, doc.y + 2);
  doc.moveDown(0.8);

  const labelValue = (label: string, value: string) => {
    const y = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor(PDF_BRAND.mutedText).text(label, left, y, { width: 170 });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(PDF_BRAND.inkBlack).text(value, left + 180, y, { width: contentWidth - 180 });
    doc.moveDown(0.45);
  };
  const section = (title: string) => {
    doc.moveDown(0.6);
    const y = doc.y;
    doc.rect(left, y, contentWidth, 20).fill(PDF_BRAND.warmWhite);
    doc.fillColor(PDF_BRAND.deepNavy).font("Helvetica-Bold").fontSize(11).text(title, left + 8, y + 5);
    doc.y = y + 28;
  };

  labelValue("Booking ID", input.bookingId);
  labelValue("Reference", input.leadReference);
  labelValue("Customer", `${input.customerName} · ${input.customerMobile}`);

  section(`${OPERATIONAL_BLOCK_TITLE[input.block.kind]} details`);
  for (const row of customerBlockRows(input.block)) labelValue(row.label, row.value);

  section("Passengers");
  input.passengers.forEach((passenger, index) => {
    labelValue(`${index + 1}. ${passenger.fullName}`, passenger.passportNumber ? `Passport ${passenger.passportNumber}` : "—");
  });

  section("Instructions");
  const instructions = input.block.instructions?.trim();
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(PDF_BRAND.inkBlack)
    .text(instructions || "Please follow the reporting time above. For any question, contact TripNexio using the details below.", left, doc.y, {
      width: contentWidth,
    });

  // Footer
  doc.moveDown(2);
  doc.moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).strokeColor(PDF_BRAND.hairline).stroke();
  doc.moveDown(0.6);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(PDF_BRAND.mutedText)
    .text(
      [
        companyName,
        input.company.address,
        input.company.phone,
        input.company.email,
        `Generated ${input.generatedAt.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      ]
        .filter((part) => part && part.trim())
        .join(" · "),
      left,
      doc.y,
      { width: contentWidth, align: "center" }
    );

  doc.end();
  return done;
}
