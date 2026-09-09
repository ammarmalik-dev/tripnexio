import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

/**
 * Scoped to one document, one passenger, and/or one booking —
 * PassportExtractionReview.tsx queries by passengerId, DocumentExtractionReview.tsx
 * (TICKET/VISA) queries by documentId (a document can have more than one
 * extraction attempt over time, e.g. a re-upload, and the caller wants only
 * this document's own). At least one filter is required (Step 16, audit
 * §3.6 — generalized from the old passenger-only /api/passport-extractions).
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("documents.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  const passengerId = searchParams.get("passengerId");
  const bookingId = searchParams.get("bookingId");
  if (!documentId && !passengerId && !bookingId) {
    return jsonError(400, "Provide a documentId, passengerId, and/or bookingId query parameter.");
  }

  const extractions = await db.documentExtraction.findMany({
    where: {
      ...(documentId ? { documentId } : {}),
      ...(passengerId ? { passengerId } : {}),
      ...(bookingId ? { bookingId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return jsonSuccess(extractions);
}
