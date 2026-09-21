import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Serves a file kept in the database (see saveUploadedFile's fallback). The
 * id is a random UUID, so — like the /uploads/... paths it stands in for —
 * possession of the link is what grants access.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const blob = await db.fileBlob.findUnique({ where: { id } });
  if (!blob) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(blob.data), {
    headers: {
      "Content-Type": blob.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
