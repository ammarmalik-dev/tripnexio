import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { runAbandonedQuoteCouponJob } from "@/lib/coupons/abandoned-quote-coupons";

/**
 * P24 — called by n8n's "Abandoned Quotation Coupons" workflow. Does nothing
 * unless Admin → Coupons has the abandoned-quotation coupon automation
 * enabled and fully configured; see runAbandonedQuoteCouponJob for the rules.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("abandoned-quote-coupons", runAbandonedQuoteCouponJob);
    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/abandoned-quote-coupons]", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Abandoned quotation coupon job failed.");
  }
}

/** P26 — Vercel Cron calls this with GET (see vercel.json); same handler and auth as n8n's POST. */
export const GET = POST;
