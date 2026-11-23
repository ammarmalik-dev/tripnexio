import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { buildSalesTracker } from "@/lib/reports/sales-tracker";
import { ServiceType } from "@/generated/prisma/enums";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceType: z.enum(Object.values(ServiceType) as [ServiceType, ...ServiceType[]]).optional(),
  staffId: z.string().min(1).optional(),
});

/** Client doc 16 Nov (J9) — Admin Sales Tracker: POC-wise and team performance for a period (staff.manage). */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return jsonError(400, "Choose a valid date range.");
  const from = new Date(`${parsed.data.from}T00:00:00Z`);
  const to = new Date(`${parsed.data.to}T23:59:59.999Z`);
  if (from > to) return jsonError(400, "The start date must be before the end date.");
  try {
    const result = await buildSalesTracker({ from, to, serviceType: parsed.data.serviceType, staffId: parsed.data.staffId });
    const targets = await db.salesTarget.findMany({ where: { month: { in: result.months } }, select: { userId: true, month: true, targetConverted: true, targetRevenue: true } });
    return jsonSuccess({ ...result, targets: targets.map((target) => ({ ...target, targetRevenue: Number(target.targetRevenue) })) });
  } catch (error) {
    console.error("[admin/sales-tracker]", error instanceof Error ? error.message : "error");
    return jsonError(500, "Couldn't build the sales tracker. Please try again.");
  }
}

const targetSchema = z.object({
  userId: z.string().min(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month"),
  targetConverted: z.number().int().min(0).max(100000),
  targetRevenue: z.number().min(0).max(1_000_000_000),
});

/** Set a POC's monthly target (converted leads + revenue). Audited. */
export async function PUT(request: NextRequest) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = targetSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const user = await db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, name: true } });
  if (!user) return jsonError(404, "Staff member not found.");
  const { month, targetConverted, targetRevenue } = parsed.data;
  const saved = await db.$transaction(async (tx) => {
    const previous = await tx.salesTarget.findUnique({ where: { userId_month: { userId: user.id, month } } });
    const row = await tx.salesTarget.upsert({
      where: { userId_month: { userId: user.id, month } },
      create: { userId: user.id, month, targetConverted, targetRevenue },
      update: { targetConverted, targetRevenue },
    });
    await writeAudit(tx, {
      entityType: "SalesTarget",
      entityId: row.id,
      action: previous ? "UPDATE" : "CREATE",
      byUserId: session.id,
      note: `Sales target for ${user.name}, ${month}: ${previous ? `${previous.targetConverted} converted / ₹${previous.targetRevenue} → ` : ""}${targetConverted} converted / ₹${targetRevenue} (by ${session.name})`,
    });
    return row;
  });
  return jsonSuccess({ ...saved, targetRevenue: Number(saved.targetRevenue) });
}
