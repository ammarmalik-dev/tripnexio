import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { executeDocumentRetention, planDocumentRetention } from "@/lib/documents/retention";
import { getSystemConfig } from "@/lib/settings/system-config";

/**
 * P27 - client decision: ALL documents auto-delete after the Admin-selected
 * number of days (System Configuration -> Document retention). No type is
 * exempt. The rules (closed bookings, never-booked leads, never an active
 * case) live in src/lib/documents/retention.ts.
 *
 * Real delete by default when called with the automation key (daily cron);
 * `?dryRun=true` (or a JSON body `{"dryRun": true}`) only previews counts
 * and writes nothing.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  let dryRun = request.nextUrl.searchParams.get("dryRun") === "true";
  try {
    const body = await request.json();
    if (body?.dryRun === true) dryRun = true;
  } catch {
    // No body (cron GET) or invalid JSON - the query string decides.
  }

  try {
    const summary = await recordAutomationRun("document-retention", async () => {
      const { documentRetentionDays } = await getSystemConfig();
      const plan = await planDocumentRetention(documentRetentionDays);
      if (dryRun) {
        return {
          dryRun: true,
          retentionDays: plan.retentionDays,
          cutoff: plan.cutoff.toISOString(),
          wouldPurgeDocuments: plan.documents.length,
          wouldPurgeBankSlips: plan.bankSlips.length,
          keptActiveOrRecent: plan.keptActiveOrRecent,
          wouldPurgeDocumentIds: plan.documents.slice(0, 500).map((doc) => doc.id),
          wouldPurgeBankSlipPaymentIds: plan.bankSlips.slice(0, 500).map((slip) => slip.paymentId),
          byType: plan.documents.reduce<Record<string, number>>((acc, doc) => {
            acc[doc.type] = (acc[doc.type] ?? 0) + 1;
            return acc;
          }, {}),
        };
      }
      const result = await executeDocumentRetention(plan);
      return { dryRun: false, retentionDays: plan.retentionDays, ...result, keptActiveOrRecent: plan.keptActiveOrRecent };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/document-retention]", error);
    return jsonError(500, "Document retention job failed.");
  }
}

/** P26 — Vercel Cron calls this with GET (see vercel.json); same handler and auth as n8n's POST. */
export const GET = POST;
