import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** P23 — every create/update of one pricing rule (old → new values, who, when), newest first. Admin-only (masters.manage). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const rule = await db.pricingRule.findUnique({ where: { id }, select: { id: true } });
    if (!rule) return jsonError(404, "Pricing rule not found.");

    const entries = await db.pricingRuleHistory.findMany({
      where: { pricingRuleId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const userIds = [...new Set(entries.map((entry) => entry.userId).filter((userId): userId is string => !!userId))];
    const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
    const nameById = new Map(users.map((user) => [user.id, user.name]));

    return jsonSuccess(
      entries.map((entry) => ({
        id: entry.id,
        action: entry.action,
        oldValues: entry.oldValues,
        newValues: entry.newValues,
        userId: entry.userId,
        userName: entry.userId ? (nameById.get(entry.userId) ?? null) : null,
        createdAt: entry.createdAt,
      }))
    );
  } catch {
    return jsonError(500, "Couldn't load this pricing rule's history.");
  }
}
