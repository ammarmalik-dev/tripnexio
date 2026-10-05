import type { NextRequest } from "next/server";
import { zipSync } from "fflate";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { FILE_URL_PREFIX, readStoredFile } from "@/lib/storage/local-file-storage";
import { sniffMimeType } from "@/lib/uploads/validate-upload";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._ -]/g, "_").trim() || "file";
}

/**
 * Client corrections 2026-10-05 — every document of one booking, all
 * travellers, in a single ZIP (one folder per traveller, "General" for
 * documents not tied to a traveller). Same access rule as /api/files
 * (documents.view + service scope). Purged files are skipped. Audited.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("documents.view");
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const booking = await db.booking.findUnique({
      where: { id },
      select: {
        bookingId: true,
        lead: { select: { serviceType: true } },
        documents: { select: { id: true, type: true, fileUrl: true, purgedAt: true, passenger: { select: { fullName: true } } } },
      },
    });
    if (!booking) return jsonError(404, "Booking not found.");
    const scopeError = assertServiceAccess(auth.session, booking.lead.serviceType);
    if (scopeError) return scopeError;

    const files: Record<string, Uint8Array> = {};
    // One file at a time, so the request never holds several pooled connections.
    for (const document of booking.documents) {
      if (document.purgedAt || !document.fileUrl?.startsWith(FILE_URL_PREFIX)) continue;
      const stored = await readStoredFile(document.fileUrl.slice(FILE_URL_PREFIX.length));
      if (!stored) continue;
      const extension = EXTENSIONS[sniffMimeType(stored.data) ?? ""] ?? "bin";
      const folder = safeName(document.passenger?.fullName ?? "General");
      const base = `${folder}/${safeName(document.type)}`;
      let name = `${base}.${extension}`;
      for (let suffix = 2; files[name]; suffix++) name = `${base}-${suffix}.${extension}`;
      files[name] = new Uint8Array(stored.data);
    }
    if (Object.keys(files).length === 0) return jsonError(404, "This booking has no downloadable documents yet.");

    const zip = zipSync(files, { level: 0 });
    await writeAudit(db, {
      entityType: "Booking",
      entityId: id,
      action: "DOCUMENTS_DOWNLOADED",
      byUserId: auth.session.id,
      note: `All documents of booking ${booking.bookingId} downloaded as a ZIP (${Object.keys(files).length} file(s)) (by ${auth.session.name})`,
    });

    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName(booking.bookingId)}-documents.zip"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/bookings/documents-zip] failed", error);
    return jsonError(500, "Couldn't prepare the documents. Please try again.");
  }
}
