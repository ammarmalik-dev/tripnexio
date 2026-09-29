import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { saveUploadedFile } from "@/lib/storage/local-file-storage";
import { OUTPUT_TYPES } from "@/lib/outputs/output-types";
import { deliverOutput } from "@/lib/outputs/deliver-output";
import { leadOperationalBlock, parseOperationalBlock } from "@/lib/visa-change/operational";
import { renderVisaChangePackagePdf } from "@/lib/visa-change/package-pdf";
import { getInvoiceCompanyDetails } from "@/lib/invoices/company-config";
import { leadReference } from "@/lib/leads/reference";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * P14 — Visa_Change.md §21: generate the brand-styled package PDF for an A2A
 * or Border Exit booking and deliver it through the P09 output path
 * (PACKAGE_PDF -> "Package Generated", customer notified). Only when:
 * payment is received, the operational details are complete (the selected
 * option's snapshot, else the lead's panel), and every customer document
 * for this booking is verified. Generated once — after that the P04 refund
 * rule stops refunds ("none after package generated").
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("documents.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      lead: { include: { quotations: { where: { isSelected: true }, take: 1 } } },
      customer: true,
      passengers: { include: { passenger: { select: { id: true, fullName: true, passportNumber: true } } }, orderBy: { createdAt: "asc" } },
      payments: { where: { status: "SUCCESS" }, select: { id: true } },
    },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (booking.lead.serviceType !== "VISA_CHANGE") return jsonError(409, "Packages are generated for Visa Change bookings only.");

  if (await db.document.count({ where: { bookingId: id, type: "PACKAGE_PDF" } })) {
    return jsonError(409, "The package was already generated for this booking.");
  }
  if (booking.payments.length === 0) return jsonError(409, "Payment hasn't been received for this booking yet.");

  const block = parseOperationalBlock(booking.lead.quotations[0]?.operationalBlock) ?? leadOperationalBlock(booking.lead.details);
  if (!block) return jsonError(409, "Complete the operational details on the lead before generating the package.");

  const passengerIds = booking.passengers.map((row) => row.passenger.id);
  const documents = await db.document.findMany({
    where: {
      type: { notIn: [...OUTPUT_TYPES] },
      OR: [{ bookingId: id }, { bookingId: null, passengerId: { in: passengerIds } }],
    },
    select: { type: true, status: true },
  });
  const unverified = documents.filter((doc) => doc.status !== "VERIFIED");
  if (documents.length === 0 || unverified.length > 0) {
    return jsonError(
      409,
      documents.length === 0
        ? "No customer documents are on file yet — verify them before generating the package."
        : `Verify every document first (${unverified.length} not verified: ${[...new Set(unverified.map((doc) => doc.type))].join(", ")}).`
    );
  }

  try {
    const pdf = await renderVisaChangePackagePdf({
      bookingId: booking.bookingId,
      leadReference: leadReference(booking.lead),
      customerName: booking.customer.name,
      customerMobile: booking.customer.mobile,
      passengers: booking.passengers.map((row) => ({ fullName: row.passenger.fullName, passportNumber: row.passenger.passportNumber })),
      block,
      company: await getInvoiceCompanyDetails(),
      generatedAt: new Date(),
    });
    const { url } = await saveUploadedFile(pdf.toString("base64"));
    const document = await deliverOutput({
      booking,
      outputType: "PACKAGE_PDF",
      passengerId: null,
      fileUrl: url,
      actor: { userId: session.id, label: `by ${session.name}` },
      verb: "generated and delivered",
    });
    return jsonSuccess(document, 201);
  } catch (error) {
    console.error("[bookings/visa-change-package]", describeError(error));
    return jsonError(500, "Couldn't generate the package. Please try again.");
  }
}
