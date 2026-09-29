import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { securityQuestionSchema, normalizeSecurityAnswer } from "@/lib/validation/staff-profile-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { getStaffSession } from "@/lib/auth/staff-session";
import { isRateLimited, rateLimitByIp } from "@/lib/auth/rate-limit";

/**
 * P22 item 5 — CRM.md §31 Security Question. Stores the chosen question
 * plus a bcrypt hash of the normalized answer — the plain answer is never
 * stored, logged, or returned, and neither is the hash. Requires the
 * current password, so a borrowed signed-in browser can't quietly set one.
 */
export async function PATCH(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const limited = await rateLimitByIp(request, "staff-security-question", { limit: 10 }, "Too many attempts. Please try again later.");
  if (limited) return limited;
  if (await isRateLimited(`staff-security-question-user:${session.id}`, { limit: 5 })) {
    return jsonError(429, "Too many attempts. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = securityQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const user = await db.user.findUnique({ where: { id: session.id }, select: { passwordHash: true, securityQuestion: true } });
    if (!user) return jsonError(401, "Sign in required.");

    const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!passwordMatches) {
      return jsonError(400, "Your current password is incorrect.", { password: ["Your current password is incorrect."] });
    }

    const securityAnswerHash = await bcrypt.hash(normalizeSecurityAnswer(parsed.data.answer), 10);
    const wasSet = Boolean(user.securityQuestion);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.id },
        data: { securityQuestion: parsed.data.question, securityAnswerHash },
      });
      await writeAudit(tx, {
        entityType: "User",
        entityId: session.id,
        action: wasSet ? "SECURITY_QUESTION_UPDATED" : "SECURITY_QUESTION_SET",
        byUserId: session.id,
        note: `Security question ${wasSet ? "updated" : "set"} from the CRM Profile page (by ${session.name})`,
      });
    });

    return jsonSuccess({ securityQuestion: parsed.data.question });
  } catch (error) {
    console.error("[profile-security-question] failed", error instanceof Error ? error.message : "unknown");
    return jsonError(500, "Couldn't save your security question. Please try again.");
  }
}
