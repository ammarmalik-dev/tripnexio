import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/storage/local-file-storage";

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

/**
 * Public card/hero image of a New Visa country page. Uploaded files are
 * otherwise private (/api/files needs a session), so this only serves an id
 * that a country page actually references as its card or hero image, and
 * only image types. Anything else is a 404.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { fileId } = await params;
  try {
    const referenced = await db.newVisaCountryPage.count({
      where: { OR: [{ cardImageFileId: fileId }, { heroImageFileId: fileId }] },
    });
    if (referenced === 0) return new Response("Not found", { status: 404 });

    const file = await readStoredFile(fileId);
    if (!file || !file.mimeType.startsWith("image/")) return new Response("Not found", { status: 404 });

    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        // A replaced image gets a new id, so the old URL can be cached long.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[new-visa-pages/image] failed", error);
    return new Response("Not found", { status: 404 });
  }
}
