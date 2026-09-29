import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { ServiceType } from "@/generated/prisma/enums";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SERVICE_TYPES = Object.values(ServiceType) as string[];

/**
 * P23 — one vendor's service-wise rate history (old → new, who, when),
 * newest first; `?service=` narrows to one service. Internal — masters.manage only.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const { id } = await params;
  const service = new URL(request.url).searchParams.get("service");
  if (service && !SERVICE_TYPES.includes(service)) return jsonError(400, "Unknown service.");

  try {
    const vendor = await db.vendor.findUnique({ where: { id }, select: { id: true } });
    if (!vendor) return jsonError(404, "Vendor not found.");

    const entries = await db.vendorRateHistory.findMany({
      where: { vendorId: id, ...(service ? { service: service as ServiceType } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const userIds = [...new Set(entries.map((entry) => entry.userId).filter((userId): userId is string => !!userId))];
    const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
    const nameById = new Map(users.map((user) => [user.id, user.name]));

    return jsonSuccess(
      entries.map((entry) => ({
        id: entry.id,
        service: entry.service,
        oldValues: entry.oldValues,
        newValues: entry.newValues,
        userName: entry.userId ? (nameById.get(entry.userId) ?? null) : null,
        createdAt: entry.createdAt,
      }))
    );
  } catch {
    return jsonError(500, "Couldn't load this vendor's rate history.");
  }
}
