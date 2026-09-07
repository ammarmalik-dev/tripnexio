import type { NextRequest } from "next/server";
import { reviewPassportExtractionSchema } from "@/lib/validation/passport-extraction-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * The ONLY path anything from OCR ever reaches the Passenger record through
 * — "confirm" applies the (possibly staff-edited) fields; "reject" discards
 * the extraction with no changes. Never triggered automatically; always an
 * explicit staff action (per CLAUDE.md/the task: "never save silently").
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  const parsed = reviewPassportExtractionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const extraction = await db.passportExtraction.findUnique({ where: { id } });
  if (!extraction) return jsonError(404, "Extraction not found.");
  if (extraction.status !== "PENDING_REVIEW") {
    return jsonError(409, `This extraction has already been ${extraction.status.toLowerCase().replace("_", " ")}.`);
  }

  if (parsed.data.action === "reject") {
    const updated = await db.$transaction(async (tx) => {
      const rejected = await tx.passportExtraction.update({
        where: { id },
        data: { status: "REJECTED", reviewedByUserId: session.id, reviewedAt: new Date() },
      });
      await writeAudit(tx, {
        entityType: "PassportExtraction",
        entityId: id,
        action: "REJECT",
        byUserId: session.id,
        note: `Extraction rejected — no changes applied to the passenger (by ${session.name})`,
      });
      return rejected;
    });
    return jsonSuccess(updated);
  }

  const { fields } = parsed.data;
  let dob: Date | undefined;
  if (fields.dob) {
    dob = new Date(fields.dob);
    if (Number.isNaN(dob.getTime())) {
      return jsonError(400, "That date of birth isn't valid.", { "fields.dob": ["Enter a valid date."] });
    }
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.passenger.update({
      where: { id: extraction.passengerId },
      data: {
        ...(fields.fullName ? { fullName: fields.fullName } : {}),
        ...(fields.passportNumber ? { passportNumber: fields.passportNumber } : {}),
        ...(fields.nationality ? { nationality: fields.nationality } : {}),
        ...(dob ? { dob } : {}),
      },
    });
    await writeAudit(tx, {
      entityType: "Passenger",
      entityId: extraction.passengerId,
      action: "UPDATE",
      byUserId: session.id,
      note: `Passport fields applied from OCR extraction ${id}, confirmed by staff (by ${session.name})`,
    });

    const confirmed = await tx.passportExtraction.update({
      where: { id },
      data: { status: "CONFIRMED", reviewedByUserId: session.id, reviewedAt: new Date(), extractedFields: fields },
    });
    await writeAudit(tx, {
      entityType: "PassportExtraction",
      entityId: id,
      action: "CONFIRM",
      byUserId: session.id,
      note: `Extraction confirmed and applied to passenger ${extraction.passengerId} (by ${session.name})`,
    });
    return confirmed;
  });

  return jsonSuccess(updated);
}
