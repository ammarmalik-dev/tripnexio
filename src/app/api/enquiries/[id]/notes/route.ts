import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";
import { enquiryNoteSchema } from "@/lib/enquiries/schemas";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Internal staff note on an enquiry (kept in its activity timeline, never shown to the customer). */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = enquiryNoteSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    const enquiry = await db.enquiry.findUnique({ where: { id }, select: { id: true } });
    if (!enquiry) return jsonError(404, "Enquiry not found.");
    await writeAudit(db, {
      entityType: "Enquiry",
      entityId: id,
      action: "NOTE",
      byUserId: session.id,
      note: `${parsed.data.note} (by ${session.name})`,
    });
    return jsonSuccess({ ok: true }, 201);
  } catch (error) {
    console.error("[api/enquiries/[id]/notes] failed", error);
    return jsonError(500, "Couldn't save the note. Please try again.");
  }
}
