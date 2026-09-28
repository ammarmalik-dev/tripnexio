import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { rateLimitByIp } from "@/lib/auth/rate-limit";

const bodySchema = z.object({ token: z.string().regex(/^[a-f0-9]{32}$/) });

/** Public, token-gated: the unsubscribe link in follow-up reminders. Idempotent; the choice is stored on the Lead. */
export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "follow-ups-stop", { limit: 20, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(404, "This link isn't valid.");

  const lead = await db.lead.findUnique({ where: { customerToken: parsed.data.token } });
  if (!lead) return jsonError(404, "This link isn't valid.");

  if (!lead.followUpOptOut) {
    await db.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: lead.id }, data: { followUpOptOut: true } });
      await writeAudit(tx, { entityType: "Lead", entityId: lead.id, action: "FOLLOW_UP_OPT_OUT", note: "Customer stopped follow-up reminders via the unsubscribe link" });
    });
  }
  return jsonSuccess({ stopped: true });
}
