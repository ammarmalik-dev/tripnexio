import { db } from "../db";

/**
 * Client corrections 2026-10-05 — offline (bank transfer) payment is only for
 * leads created internally by staff: a Manual Lead (details.manualEntry), or a
 * lead whose creation was recorded against a staff user (e.g. an enquiry
 * converted to a lead). Website / WhatsApp leads pay online only.
 */
export async function isInternallyCreatedLead(lead: { id: string; details: unknown }): Promise<boolean> {
  const details = (lead.details ?? {}) as Record<string, unknown>;
  if (details.manualEntry === true) return true;
  const created = await db.auditTrail.findFirst({
    where: { entityType: "Lead", entityId: lead.id, action: "CREATE", byUserId: { not: null } },
    select: { id: true },
  });
  return created !== null;
}
