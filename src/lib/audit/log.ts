import type { Prisma } from "../../generated/prisma/client";

export interface WriteAuditInput {
  entityType: string;
  entityId: string;
  action: string;
  note?: string;
  byUserId?: string;
}

/** Every state change writes here (CLAUDE.md quality standard) — reuse this instead of calling tx.auditTrail.create inline. */
export async function writeAudit(tx: Prisma.TransactionClient, input: WriteAuditInput) {
  await tx.auditTrail.create({ data: input });
}
