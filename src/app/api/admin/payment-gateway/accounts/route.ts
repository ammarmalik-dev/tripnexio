import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { ENV_PREFIX_PATTERN } from "@/lib/payments/accounts";
import { gatewayAccountView } from "@/lib/payments/account-view";

const createSchema = z.object({
  provider: z.enum(["RAZORPAY", "CASHFREE"]),
  label: z.string().trim().min(2, "Enter a label").max(60),
  envPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ENV_PREFIX_PATTERN, "Use capital letters, digits and _ (e.g. RAZORPAY_B, CASHFREE)"),
});

/** Client corrections 2026-10-05 §27 — every gateway account in failover order, with 30-day attempt stats. */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const accounts = await db.paymentGatewayAccount.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const grouped = await db.paymentGatewayAttempt.groupBy({
    by: ["accountId", "succeeded"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const stats = (accountId: string) => {
    const rows = grouped.filter((row) => row.accountId === accountId);
    const last = rows.map((row) => row._max.createdAt).filter((date): date is Date => Boolean(date)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    return {
      attempts: rows.reduce((sum, row) => sum + row._count._all, 0),
      failures: rows.filter((row) => !row.succeeded).reduce((sum, row) => sum + row._count._all, 0),
      lastAttemptAt: last,
    };
  };
  return jsonSuccess(accounts.map((account) => gatewayAccountView(account, stats(account.id))));
}

/** Adds a gateway account (credentials go into the env vars it names — never into the database). */
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;

  if (await db.paymentGatewayAccount.findUnique({ where: { envPrefix: parsed.data.envPrefix } })) {
    return jsonError(409, "Another account already uses that env prefix.", { envPrefix: ["Already in use."] });
  }
  const last = await db.paymentGatewayAccount.findFirst({ orderBy: { priority: "desc" }, select: { priority: true } });

  const created = await db.$transaction(async (tx) => {
    const account = await tx.paymentGatewayAccount.create({
      data: { ...parsed.data, priority: (last?.priority ?? 0) + 1, active: true },
    });
    await writeAudit(tx, {
      entityType: "PaymentGatewayAccount",
      entityId: account.id,
      action: "CREATE",
      byUserId: session.id,
      note: withReason(`Gateway account added: ${account.label} (${account.provider}, env ${account.envPrefix}_*) at priority ${account.priority} (by ${session.name})`, reasonResult.reason),
    });
    return account;
  });
  return jsonSuccess(gatewayAccountView(created), 201);
}
