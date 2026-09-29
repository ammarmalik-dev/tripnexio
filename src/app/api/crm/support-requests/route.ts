import type { NextRequest } from "next/server";
import { supportRequestSchema } from "@/lib/validation/support-request-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { getStaffSession } from "@/lib/auth/staff-session";
import { isRateLimited } from "@/lib/auth/rate-limit";

/**
 * P22 item 2 — CRM Help page "Report an issue" (CRM.md §28). Any signed-in
 * staff member can file one; it lands as an unassigned SUPPORT_REQUEST Task
 * linked to the reporter (entityType "User"), so admins pick it up from the
 * Tasks screen rather than a separate inbox.
 */
export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  if (await isRateLimited(`support-request:${session.id}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return jsonError(429, "You've reported several issues recently. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = supportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const { title, description, pageUrl, priority } = parsed.data;
  const reason = pageUrl ? `${description}\n\nPage / URL: ${pageUrl}` : description;

  try {
    const task = await db.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          type: "SUPPORT_REQUEST",
          priority,
          title,
          reason,
          entityType: "User",
          entityId: session.id,
        },
      });
      await writeAudit(tx, {
        entityType: "Task",
        entityId: created.id,
        action: "CREATE",
        byUserId: session.id,
        note: `Support request "${created.title}" reported from the CRM Help page (by ${session.name})`,
      });
      return created;
    });

    return jsonSuccess({ id: task.id }, 201);
  } catch (error) {
    console.error("[support-requests] create failed", error instanceof Error ? error.message : "unknown");
    return jsonError(500, "Couldn't submit your report. Please try again.");
  }
}
