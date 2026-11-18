import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { readKnowledgeFile, safeDownloadName, sniffKnowledgeDocument } from "@/lib/knowledge/document-files";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Client doc 16 Nov (L4) — view / download a Knowledge Centre document; staff with knowledge.view only. A PDF opens
 * in the browser (View), a Word file always downloads; `?download=1` downloads either.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("knowledge.view");
  if (auth.error) return auth.error;
  const { id } = await params;

  const document = await db.knowledgeDocument.findUnique({ where: { id }, select: { fileName: true, storageKey: true } });
  if (!document) return new Response("Not found", { status: 404 });
  const data = await readKnowledgeFile(document.storageKey);
  if (!data) return new Response("Not found", { status: 404 });

  const mimeType = sniffKnowledgeDocument(data) ?? "application/octet-stream";
  const inline = mimeType === "application/pdf" && request.nextUrl.searchParams.get("download") !== "1";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeDownloadName(document.fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
