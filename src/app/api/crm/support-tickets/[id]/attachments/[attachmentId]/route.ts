import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { findVisibleTicket } from "@/lib/support/ticket-access";
import { FILE_URL_PREFIX, readStoredFile } from "@/lib/storage/local-file-storage";
import { sniffMimeType } from "@/lib/uploads/validate-upload";

interface RouteParams {
  params: Promise<{ id: string; attachmentId: string }>;
}

/** Client doc 16 Nov (L3) — a ticket's screenshot / file, only for the raiser and the help desk managers. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getStaffSession();
  if (!session) return new Response("Not found", { status: 404 });
  const { id, attachmentId } = await params;
  if (!(await findVisibleTicket(session, id))) return new Response("Not found", { status: 404 });

  const attachment = await db.supportTicketAttachment.findFirst({ where: { id: attachmentId, ticketId: id }, select: { fileUrl: true, fileName: true } });
  if (!attachment || !attachment.fileUrl.startsWith(FILE_URL_PREFIX)) return new Response("Not found", { status: 404 });
  const stored = await readStoredFile(attachment.fileUrl.slice(FILE_URL_PREFIX.length));
  if (!stored) return new Response("Not found", { status: 404 });

  const mimeType = sniffMimeType(stored.data) ?? "application/octet-stream";
  const safeName = attachment.fileName.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "attachment";
  return new Response(new Uint8Array(stored.data), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${mimeType.startsWith("image/") || mimeType === "application/pdf" ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
