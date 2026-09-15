import type { NextRequest } from "next/server";
import { reuseDocumentSchema } from "@/lib/validation/document-reuse-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { getReusableDocumentsForPassenger } from "@/lib/documents/reuse";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * "Use Existing" — New_Visa.md §17: "Do not automatically reuse without
 * customer confirmation." This IS the confirmation action (an explicit
 * staff click, standing in for the customer's confirmation the same way
 * every other customer-facing decision in this CRM is staff-recorded, per
 * the "staff processes everything manually" model). Clones the source
 * document's type+fileUrl onto a new row scoped to the target
 * booking/passenger, leaving the original untouched — never mutates or
 * moves the source, so its own history stays intact.
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

  const parsed = reuseDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  if (!parsed.data.bookingId && !parsed.data.passengerId) {
    return jsonError(400, "Specify a bookingId or passengerId to attach the reused document to.");
  }

  const source = await db.document.findUnique({ where: { id } });
  if (!source) return jsonError(404, "Document not found.");
  if (!source.fileUrl) return jsonError(409, "This document has no file to reuse.");
  if (!source.passengerId) return jsonError(409, "This document isn't linked to a passenger, so its reuse history can't be verified.");

  // Re-checked server-side, not just trusted from whatever the staff UI
  // last fetched — the file could have aged past the window, or been
  // purged, since the prompt loaded.
  const candidates = await getReusableDocumentsForPassenger(source.passengerId);
  const candidate = candidates.find((doc) => doc.id === id);
  if (!candidate || !candidate.reusable) {
    return jsonError(409, "This document is no longer eligible for reuse — request a fresh upload instead.");
  }

  const created = await db.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        passengerId: parsed.data.passengerId ?? source.passengerId,
        bookingId: parsed.data.bookingId,
        type: source.type,
        status: "RECEIVED",
        fileUrl: source.fileUrl,
      },
    });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: document.id,
      action: "REUSE_CONFIRMED",
      byUserId: session.id,
      note: `Reused document ${source.id} (${source.type}, ${candidate.ageInDays} days old) — confirmed by staff (by ${session.name})`,
    });
    return document;
  });

  return jsonSuccess(created, 201);
}
