import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { isExpiredNow } from "@/lib/quotations/sync-expiry";
import { getStaffSession } from "@/lib/auth/staff-session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Selecting a quotation expires every other quotation on the same lead — the spec's "one active quotation" rule. */
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const { id } = await params;

  const quotation = await db.quotation.findUnique({ where: { id } });
  if (!quotation) return jsonError(404, "Quotation not found.");
  if (isExpiredNow(quotation)) {
    return jsonError(409, "This quotation has expired and can't be selected.");
  }
  if (quotation.isSelected) {
    return jsonSuccess(quotation);
  }

  const result = await db.$transaction(async (tx) => {
    const others = await tx.quotation.findMany({
      where: { leadId: quotation.leadId, id: { not: id } },
    });

    for (const other of others) {
      if (other.isSelected || !other.isExpired) {
        await tx.quotation.update({ where: { id: other.id }, data: { isSelected: false, isExpired: true } });
        await writeAudit(tx, {
          entityType: "Quotation",
          entityId: other.id,
          action: "EXPIRE",
          byUserId: session.id,
          note: `Expired — quotation ${id} was selected instead for lead ${quotation.leadId} (by ${session.name})`,
        });
      }
    }

    const selected = await tx.quotation.update({ where: { id }, data: { isSelected: true } });
    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: id,
      action: "SELECT",
      byUserId: session.id,
      note: `Selected for lead ${quotation.leadId} (by ${session.name})`,
    });

    const lead = await tx.lead.findUnique({ where: { id: quotation.leadId } });
    if (lead && lead.status !== "QUOTED" && lead.status !== "CONVERTED") {
      await tx.lead.update({ where: { id: lead.id }, data: { status: "QUOTED" } });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: lead.id,
        action: "STATUS_CHANGE",
        byUserId: session.id,
        note: `${lead.status} -> QUOTED (quotation selected by ${session.name})`,
      });
    }

    return selected;
  });

  return jsonSuccess(result);
}
