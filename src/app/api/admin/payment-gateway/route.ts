import type { NextRequest } from "next/server";
import { updatePaymentGatewayConfigSchema } from "@/lib/validation/payment-gateway-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { getPaymentGatewayStatus } from "@/lib/payments/gateway-status";
import { DEFAULT_PAYMENT_LINK_VALIDITY_HOURS } from "@/lib/payments/create-payment";

const SYSTEM_CONFIG_ID = "singleton";

function formatHours(hours: number | null): string {
  return hours == null ? `not set (${DEFAULT_PAYMENT_LINK_VALIDITY_HOURS}h default)` : `${hours}h`;
}

/**
 * P24 — Admin → Payment Gateway. Gated by `masters.manage`, the same
 * permission as the sibling payment-pricing screens (Tax & Fees, Coupons,
 * Invoice Settings, System Configuration) — `finance.manage` covers
 * expenses/P&L reporting, not payment configuration.
 *
 * GET returns the env-derived gateway status (no secrets — only set / not
 * set and a masked key id) plus the one editable, non-secret setting.
 */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  try {
    const config = await db.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID }, select: { defaultPaymentLinkHours: true } });
    const defaultPaymentLinkHours = config?.defaultPaymentLinkHours ?? null;
    return jsonSuccess({
      status: getPaymentGatewayStatus(),
      defaultPaymentLinkHours,
      fallbackPaymentLinkHours: DEFAULT_PAYMENT_LINK_VALIDITY_HOURS,
    });
  } catch (error) {
    console.error("[admin/payment-gateway] GET failed", error);
    return jsonError(500, "Couldn't load the payment gateway settings.");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updatePaymentGatewayConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const existing = await db.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID }, select: { defaultPaymentLinkHours: true } });
    const before = existing?.defaultPaymentLinkHours ?? null;
    const next = parsed.data.defaultPaymentLinkHours;

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.systemConfig.upsert({
        where: { id: SYSTEM_CONFIG_ID },
        update: { defaultPaymentLinkHours: next },
        create: { id: SYSTEM_CONFIG_ID, defaultPaymentLinkHours: next },
        select: { defaultPaymentLinkHours: true },
      });
      await writeAudit(tx, {
        entityType: "SystemConfig",
        entityId: SYSTEM_CONFIG_ID,
        action: "UPDATE",
        byUserId: session.id,
        note: `Default payment-link validity updated: ${formatHours(before)} -> ${formatHours(next)} (by ${session.name})`,
      });
      return result;
    });

    return jsonSuccess({
      status: getPaymentGatewayStatus(),
      defaultPaymentLinkHours: updated.defaultPaymentLinkHours,
      fallbackPaymentLinkHours: DEFAULT_PAYMENT_LINK_VALIDITY_HOURS,
    });
  } catch (error) {
    console.error("[admin/payment-gateway] PATCH failed", error);
    return jsonError(500, "Couldn't update the payment gateway settings.");
  }
}
