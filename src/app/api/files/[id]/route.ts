import type { NextRequest } from "next/server";
import { FILE_URL_PREFIX, readStoredFile } from "@/lib/storage/local-file-storage";
import { canAccessStoredFile } from "@/lib/storage/file-access";
import { sniffMimeType } from "@/lib/uploads/validate-upload";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const NOT_FOUND = () => new Response("Not found", { status: 404 });

/**
 * Serves a stored upload (private disk or FileBlob). Access is granted only
 * to a staff user with the right permission and service scope, the customer
 * who owns the related booking/passenger, or a holder of the related pay/
 * quote token (`?token=`) — see canAccessStoredFile. Anyone else gets 404,
 * the same as for a file that doesn't exist.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!(await canAccessStoredFile(`${FILE_URL_PREFIX}${id}`, token))) return NOT_FOUND();

  const stored = await readStoredFile(id);
  if (!stored) return NOT_FOUND();

  const mimeType = sniffMimeType(stored.data) ?? "application/octet-stream";
  const isImage = mimeType.startsWith("image/");

  return new Response(new Uint8Array(stored.data), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": isImage ? "inline" : "attachment",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
