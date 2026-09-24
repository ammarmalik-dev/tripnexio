import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/storage/local-file-storage";
import { runPassportExtraction } from "@/lib/ocr/extract-passport";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  imageBase64: z.string().min(1, "Choose an image to upload"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"], { error: "Unsupported image type" }),
});

/**
 * The CRM's own passport-photo upload — staff pick a file directly (not the
 * "paste an already-hosted URL" flow /api/documents/[id]/upload was built
 * for), matching what customers can already do at lead-submission time
 * (PassportUploadField.tsx). Creates the Document row itself (type
 * "PASSPORT") rather than requiring one to already exist, then runs OCR
 * the same way every other trigger point does.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("documents.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id: passengerId } = await params;

  const passenger = await db.passenger.findUnique({ where: { id: passengerId } });
  if (!passenger) return jsonError(404, "Passenger not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const { url } = await saveUploadedFile(parsed.data.imageBase64, parsed.data.mimeType, "passports");

    // New_Visa.md §18: "If staff requests a new passport: old passport file
    // is deleted, new becomes active." This route always creates a fresh
    // Document row (never updates one in place), so any prior PASSPORT
    // document(s) for this passenger are the ones being superseded here.
    const priorPassportDocs = await db.document.findMany({
      where: { passengerId, type: "PASSPORT", fileUrl: { not: null }, purgedAt: null },
    });

    const document = await db.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: { passengerId, type: "PASSPORT", status: "RECEIVED", fileUrl: url },
      });
      await writeAudit(tx, {
        entityType: "Document",
        entityId: created.id,
        action: "CREATE",
        byUserId: session.id,
        note: `Passport photo uploaded via Internal Dashboard (by ${session.name})`,
      });
      for (const prior of priorPassportDocs) {
        await tx.document.update({ where: { id: prior.id }, data: { fileUrl: null, purgedAt: new Date() } });
        await writeAudit(tx, {
          entityType: "Document",
          entityId: prior.id,
          action: "SUPERSEDED",
          byUserId: session.id,
          note: `Old passport file deleted — superseded by document ${created.id} (by ${session.name})`,
        });
      }
      return created;
    });

    // Best-effort, after the DB commit — same reasoning as the generic upload route's own replacement cleanup.
    for (const prior of priorPassportDocs) {
      void deleteUploadedFile(prior.fileUrl!);
    }

    const extraction = await runPassportExtraction(document.id);
    return jsonSuccess({ document, extraction }, 201);
  } catch (error) {
    console.error("[passengers/passport-photo]", error);
    return jsonError(500, "Couldn't process that image. Please try again.");
  }
}
