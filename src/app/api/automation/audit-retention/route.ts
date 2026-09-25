import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { getSystemConfig } from "@/lib/settings/system-config";

/**
 * Item 13 (client-message/PENDING_WORK_PROMPTS.md, Admin FINAL handover
 * §19). `SystemConfig.auditRetentionDays` has existed since Step 45 but
 * nothing has ever read it — this is that job.
 *
 * SAFETY DEFAULT, deliberately the OPPOSITE of document-retention's own
 * job: whether "retention" here means hard-delete or archive-then-delete
 * has never been confirmed with the client, and AuditTrail rows are often
 * exactly what's needed for a compliance/dispute question — so this job
 * defaults to `dryRun: true` (reports what WOULD be deleted, deletes
 * nothing) unless the request body explicitly says `{"dryRun": false}`.
 * Do NOT set the n8n HTTP node to send `dryRun: false` until the client
 * has actually confirmed hard-delete is what they want — see
 * AUTOMATION_WORKFLOWS.md.
 *
 * `auditRetentionDays: null` (the schema default — no admin has set a
 * real value yet) means "no retention policy configured," so this is a
 * genuine no-op either way until that's set at /admin/system-config.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  let dryRun = true;
  try {
    const body = await request.json();
    dryRun = body?.dryRun !== false;
  } catch {
    // No body (or invalid JSON) is fine — stays at the safe default (dry-run).
  }

  try {
    const summary = await recordAutomationRun("audit-retention", async () => {
      const { auditRetentionDays } = await getSystemConfig();
      if (auditRetentionDays === null) {
        return { dryRun, configured: false, cutoffDate: null, wouldPurge: 0, purged: 0 };
      }

      const cutoff = new Date(Date.now() - auditRetentionDays * 24 * 60 * 60 * 1000);
      const matchCount = await db.auditTrail.count({ where: { timestamp: { lt: cutoff } } });

      if (dryRun) {
        return { dryRun: true, configured: true, cutoffDate: cutoff.toISOString(), wouldPurge: matchCount, purged: 0 };
      }

      const result = await db.auditTrail.deleteMany({ where: { timestamp: { lt: cutoff } } });
      return { dryRun: false, configured: true, cutoffDate: cutoff.toISOString(), wouldPurge: matchCount, purged: result.count };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/audit-retention]", error);
    return jsonError(500, "Audit retention job failed.");
  }
}
