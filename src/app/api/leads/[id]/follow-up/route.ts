import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  /** YYYY-MM-DD, or null to clear it. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the follow-up date").nullable(),
  note: z.string().trim().max(300).optional(),
});

/**
 * Client doc 16 Nov (J1) — "add a new follow-up set option until converted or unqualified": staff set (or clear) the
 * lead's next follow-up date with a short note; the lead shows in Follow-ups from that day. Audited.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  const ownershipError = await assertOwnsEntity(session, "lead", id);
  if (ownershipError) return ownershipError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the follow-up.", parsed.error.flatten().fieldErrors);

  try {
    const lead = await db.lead.findUnique({ where: { id }, select: { status: true, serviceType: true } });
    if (!lead) return jsonError(404, "Lead not found.");
    const scopeError = assertServiceAccess(session, lead.serviceType);
    if (scopeError) return scopeError;
    if (parsed.data.date && (lead.status === "CONVERTED" || lead.status === "LOST" || lead.status === "CLOSED")) {
      return jsonError(409, "This lead is converted or closed — no follow-up needed.");
    }
    const at = parsed.data.date ? new Date(`${parsed.data.date}T00:00:00Z`) : null;
    await db.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data: { nextFollowUpAt: at, followUpNote: parsed.data.date ? (parsed.data.note || null) : null } });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: id,
        action: "FOLLOW_UP_SET",
        byUserId: session.id,
        note: `${at ? `Follow-up set for ${parsed.data.date}${parsed.data.note ? `: ${parsed.data.note}` : ""}` : "Follow-up cleared"} (by ${session.name})`,
      });
    });
    return jsonSuccess({ nextFollowUpAt: at, followUpNote: parsed.data.date ? (parsed.data.note || null) : null });
  } catch (error) {
    console.error("[api/leads/follow-up]", describeError(error));
    return jsonError(500, "Couldn't save the follow-up.");
  }
}
