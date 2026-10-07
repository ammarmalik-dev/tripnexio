import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { gatewayAccountView } from "@/lib/payments/account-view";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  action: z.enum(["MAKE_PRIMARY", "MOVE_UP", "MOVE_DOWN", "ACTIVATE", "DEACTIVATE", "RENAME"]),
  label: z.string().trim().min(2).max(60).optional(),
});

/**
 * Client corrections 2026-10-05 §27 — Admin controls on one gateway account:
 * Switch Gateway (make primary), change priority, activate / disable, rename.
 * Every change needs a reason and is audited. The last active account can't
 * be disabled (payments would stop).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { action, label } = parsed.data;

  const accounts = await db.paymentGatewayAccount.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  const index = accounts.findIndex((account) => account.id === id);
  if (index < 0) return jsonError(404, "Gateway account not found.");
  const account = accounts[index];

  if (action === "DEACTIVATE" && account.active && accounts.filter((row) => row.active).length <= 1) {
    return jsonError(409, "This is the only active gateway account — add or activate another one first.");
  }
  if (action === "RENAME" && !label) return jsonError(400, "Enter the new label.", { label: ["Required."] });

  // New order for priority moves (renumbered 1..n so priorities stay unique and compact).
  let order = accounts.map((row) => row.id);
  if (action === "MAKE_PRIMARY") order = [id, ...order.filter((rowId) => rowId !== id)];
  if (action === "MOVE_UP" && index > 0) [order[index - 1], order[index]] = [order[index], order[index - 1]];
  if (action === "MOVE_DOWN" && index < order.length - 1) [order[index + 1], order[index]] = [order[index], order[index + 1]];
  const reorders = action === "MAKE_PRIMARY" || action === "MOVE_UP" || action === "MOVE_DOWN";

  const describe = {
    MAKE_PRIMARY: `switched the primary gateway to ${account.label}`,
    MOVE_UP: `moved ${account.label} up the failover order`,
    MOVE_DOWN: `moved ${account.label} down the failover order`,
    ACTIVATE: `activated ${account.label}`,
    DEACTIVATE: `disabled ${account.label}`,
    RENAME: `renamed ${account.label} to ${label}`,
  }[action];

  const updated = await db.$transaction(async (tx) => {
    if (reorders) {
      for (const [position, rowId] of order.entries()) {
        await tx.paymentGatewayAccount.update({ where: { id: rowId }, data: { priority: position + 1 } });
      }
    }
    if (action === "MAKE_PRIMARY" || action === "ACTIVATE") await tx.paymentGatewayAccount.update({ where: { id }, data: { active: true } });
    if (action === "DEACTIVATE") await tx.paymentGatewayAccount.update({ where: { id }, data: { active: false } });
    if (action === "RENAME" && label) await tx.paymentGatewayAccount.update({ where: { id }, data: { label } });
    await writeAudit(tx, {
      entityType: "PaymentGatewayAccount",
      entityId: id,
      action: action === "MAKE_PRIMARY" ? "GATEWAY_SWITCHED" : `GATEWAY_${action}`,
      byUserId: session.id,
      note: withReason(`${session.name} ${describe}`, reasonResult.reason),
    });
    return tx.paymentGatewayAccount.findUniqueOrThrow({ where: { id } });
  });
  return jsonSuccess(gatewayAccountView(updated));
}
