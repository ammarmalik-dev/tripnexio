import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { isExpiredNow } from "@/lib/quotations/sync-expiry";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Selecting a quotation expires every other quotation on the same lead — the spec's "one active quotation" rule. */
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
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
          note: `Expired — quotation ${id} was selected instead for lead ${quotation.leadId}`,
        });
      }
    }

    const selected = await tx.quotation.update({ where: { id }, data: { isSelected: true } });
    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: id,
      action: "SELECT",
      note: `Selected for lead ${quotation.leadId}`,
    });

    const lead = await tx.lead.findUnique({ where: { id: quotation.leadId } });
    if (lead && lead.status !== "QUOTED" && lead.status !== "CONVERTED") {
      await tx.lead.update({ where: { id: lead.id }, data: { status: "QUOTED" } });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: lead.id,
        action: "STATUS_CHANGE",
        note: `${lead.status} -> QUOTED (quotation selected)`,
      });
    }

    return selected;
  });

  return jsonSuccess(result);
}
