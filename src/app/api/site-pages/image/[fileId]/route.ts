import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/storage/local-file-storage";

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

/**
 * Client doc 2026-10-15 (J3) — the public hero photo of a website page. Uploaded files are otherwise private,
 * so this only serves an id a page actually uses as its photo, and only images. Anything else is a 404.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { fileId } = await params;
  try {
    const referenced = await db.sitePageContent.count({ where: { heroImageFileId: fileId } });
    if (referenced === 0) return new Response("Not found", { status: 404 });
    const file = await readStoredFile(fileId);
    if (!file || !file.mimeType.startsWith("image/")) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        // A replaced photo gets a new id, so the old URL can be cached long.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[site-pages/image] failed", error);
    return new Response("Not found", { status: 404 });
  }
}
