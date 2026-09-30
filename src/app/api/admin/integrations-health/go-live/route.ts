import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { getGoLiveChecks, getGoLiveState, SYSTEM_CONFIG_ID } from "@/lib/admin/go-live-checks";

const goLiveBodySchema = z.object({ ready: z.boolean({ error: "Choose whether the system is go-live ready." }) });

/**
 * P26 — the "Go-live ready" flag on Admin → Integrations. Marking ready is
 * refused (409, listing every failing check) unless every go-live check is
 * green, re-evaluated server-side right now — never trusting what the page
 * last showed. Clearing the flag is always allowed. Both directions need a
 * reason (Business Rules §14 flow) and write an audit row.
 */
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

  const parsed = goLiveBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;
  const { ready } = parsed.data;

  try {
    if (ready) {
      const failing = (await getGoLiveChecks()).filter((check) => !check.ok);
      if (failing.length > 0) {
        return jsonError(
          409,
          `Can't mark go-live ready — ${failing.length} check(s) are still failing: ${failing.map((check) => `${check.label} (${check.detail})`).join("; ")}.`
        );
      }
    }

    const before = await db.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID }, select: { goLiveReady: true } });
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.systemConfig.upsert({
        where: { id: SYSTEM_CONFIG_ID },
        update: { goLiveReady: ready, goLiveMarkedAt: now, goLiveMarkedById: session.id },
        create: { id: SYSTEM_CONFIG_ID, goLiveReady: ready, goLiveMarkedAt: now, goLiveMarkedById: session.id },
      });
      await writeAudit(tx, {
        entityType: "SystemConfig",
        entityId: SYSTEM_CONFIG_ID,
        action: ready ? "GO_LIVE_READY" : "GO_LIVE_NOT_READY",
        byUserId: session.id,
        note: withReason(
          `Go-live flag ${before?.goLiveReady ? "ready" : "not ready"} -> ${ready ? "ready" : "not ready"} (by ${session.name})`,
          reason
        ),
      });
    });

    return jsonSuccess({ goLive: await getGoLiveState() });
  } catch (error) {
    console.error("[admin/integrations-health/go-live] PATCH failed", error);
    return jsonError(500, "Couldn't update the go-live flag.");
  }
}
