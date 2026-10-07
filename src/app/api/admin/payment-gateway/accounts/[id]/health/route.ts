import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";
import { gatewayForAccount } from "@/lib/payments/accounts";
import { gatewayAccountView } from "@/lib/payments/account-view";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Client corrections 2026-10-05 §27 — runs a read-only authenticated call against the account and stores the result. */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  const account = await db.paymentGatewayAccount.findUnique({ where: { id } });
  if (!account) return jsonError(404, "Gateway account not found.");

  const gateway = gatewayForAccount(account);
  const result = gateway
    ? await gateway.healthCheck()
    : { ok: false, message: `Not configured — set the ${account.envPrefix}_* env vars on the server.` };

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.paymentGatewayAccount.update({
      where: { id },
      data: { lastCheckedAt: new Date(), lastCheckOk: result.ok, lastCheckMessage: result.message.slice(0, 300) },
    });
    await writeAudit(tx, {
      entityType: "PaymentGatewayAccount",
      entityId: id,
      action: "GATEWAY_HEALTH_CHECK",
      byUserId: session.id,
      note: `${account.label}: ${result.ok ? "healthy" : "unhealthy"} — ${result.message} (by ${session.name})`,
    });
    return row;
  });
  return jsonSuccess(gatewayAccountView(updated));
}
