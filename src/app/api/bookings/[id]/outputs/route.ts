import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { saveUploadedFile, UploadValidationError } from "@/lib/storage/local-file-storage";
import { OUTPUT_TYPES } from "@/lib/outputs/output-types";
import { hasReachedStatusEvent } from "@/lib/service-status/engine";
import { deliverOutput } from "@/lib/outputs/deliver-output";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const deliverSchema = z.object({
  outputType: z.enum(OUTPUT_TYPES, { error: "Select what you're delivering" }),
  /** The passenger this output belongs to; omit for a booking-level output (e.g. a group package). */
  passengerId: z.string().min(1).nullable().optional(),
  fileBase64: z.string().min(1, "Choose a file"),
});

/**
 * P09 — "Upload & Deliver": staff upload the service result for a passenger
 * (or the whole booking). The file is stored as a delivered Document, the
 * booking moves to its service's matching status, and the customer gets
 * WhatsApp + email with a secure download link (tied to this booking's own
 * token). The delivery time is kept on the document.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("documents.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = deliverSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const booking = await db.booking.findUnique({
    where: { id },
    include: { lead: true, customer: true, passengers: { select: { passengerId: true } } },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;

  // P11 — a New Visa's visa PDF follows the embassy's approval.
  if (booking.lead.serviceType === "NEW_VISA" && parsed.data.outputType === "VISA_PDF" && !(await hasReachedStatusEvent(booking.id, "EMBASSY_APPROVED"))) {
    return jsonError(409, "Mark the visa as Approved before delivering the visa PDF.");
  }
  // P14 — Visa Change: the new visa PDF follows Visa Approved (never a rejected
  // one), and the package is only ever the generated one (Generate Package).
  if (booking.lead.serviceType === "VISA_CHANGE" && parsed.data.outputType === "VISA_PDF" && (booking.visaRejectionReason || !(await hasReachedStatusEvent(booking.id, "EMBASSY_APPROVED")))) {
    return jsonError(409, "Mark the visa as Approved before delivering the visa PDF.");
  }
  if (booking.lead.serviceType === "VISA_CHANGE" && parsed.data.outputType === "PACKAGE_PDF") {
    return jsonError(409, "Use Generate Package — the Visa Change package is generated from the operational details.");
  }
  // P13 — the extended visa PDF follows a recorded "Extended" outcome.
  if (booking.lead.serviceType === "VISA_EXTENSION" && parsed.data.outputType === "EXTENDED_VISA_PDF" && booking.extensionOutcome !== "EXTENDED") {
    return jsonError(409, "Record the extension outcome as Extended before delivering the extended visa PDF.");
  }

  const passengerId = parsed.data.passengerId ?? null;
  if (passengerId && !booking.passengers.some((row) => row.passengerId === passengerId)) {
    return jsonError(400, "That passenger isn't on this booking.", { passengerId: ["Select a passenger on this booking."] });
  }

  let fileUrl: string;
  try {
    fileUrl = (await saveUploadedFile(parsed.data.fileBase64)).url;
  } catch (error) {
    if (error instanceof UploadValidationError) return jsonError(error.status, error.message);
    console.error("[api/bookings/outputs] file save failed", describeError(error));
    return jsonError(500, "Couldn't save the file. Please try again.");
  }

  const document = await deliverOutput({
    booking,
    outputType: parsed.data.outputType,
    passengerId,
    fileUrl,
    actor: { userId: session.id, label: `by ${session.name}` },
  });

  return jsonSuccess(document, 201);
}
