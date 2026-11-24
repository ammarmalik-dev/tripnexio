import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { removeServiceStatus, statusUsage } from "@/lib/service-status/remove-status";
import { ServiceType, StatusScope } from "@/generated/prisma/enums";

const bodySchema = z.object({
  serviceType: z.enum(Object.values(ServiceType) as [ServiceType, ...ServiceType[]]),
  scope: z.enum(Object.values(StatusScope) as [StatusScope, ...StatusScope[]]),
});

/**
 * Client doc 16 Nov (G1) — "remove the old statuses": deletes every DISABLED status of one service list that no
 * lead, booking or SLA rule uses (with its transitions and its own templates). Disabled statuses still in use are
 * kept and listed. Reason required, one audit row per deleted status.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Pick a service and list.");
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  const disabled = await db.serviceStatus.findMany({ where: { ...parsed.data, active: false }, orderBy: { displayOrder: "asc" } });
  const deleted: string[] = [];
  const kept: string[] = [];
  try {
    for (const status of disabled) {
      if ((await statusUsage(db, status.id)).total > 0) {
        kept.push(status.name);
        continue;
      }
      await db.$transaction((tx) => removeServiceStatus(tx, status, session, reason));
      deleted.push(status.name);
    }
  } catch (error) {
    console.error("[admin/service-statuses/cleanup]", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, `Deleted ${deleted.length} status(es), then something went wrong. Please try again.`);
  }
  return jsonSuccess({ deleted, kept });
}
