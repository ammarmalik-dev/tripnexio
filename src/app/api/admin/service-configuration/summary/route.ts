import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { runSequentially } from "@/lib/db-sequential";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseServiceConfigService } from "@/lib/admin/service-configuration";
import { describeError } from "@/lib/api/describe-error";

/**
 * Client testing 2026-10-09 (F7) — the numbers on the Service Configuration
 * hub's summary cards for one service: what is configured, and what still
 * needs attention (e.g. documents not linked to the Document Master).
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const service = parseServiceConfigService(request.nextUrl.searchParams.get("service") ?? undefined);

  try {
    const [pricingRules, documents, documentsOffMaster, statuses, terms, timeline, refund, countryTimelines] = await runSequentially([
      () => db.pricingRule.count({ where: { serviceType: service, active: true } }),
      () => db.documentRequirement.count({ where: { serviceType: service, active: true } }),
      () => db.documentRequirement.count({ where: { serviceType: service, active: true, documentTypeId: null } }),
      () => db.serviceStatus.count({ where: { serviceType: service, active: true } }),
      () => db.serviceTerms.count({ where: { serviceType: service, active: true } }),
      () => db.serviceTimelineConfig.findUnique({ where: { serviceType: service } }),
      () => db.refundConfig.findUnique({ where: { serviceType: service }, select: { serviceType: true } }),
      () => (service === "NEW_VISA" ? db.newVisaCountryTimeline.count() : Promise.resolve(0)),
    ]);
    const timelineValues = timeline
      ? [timeline.processingDaysNormal, timeline.processingDaysExpress, timeline.minTravelDaysNormal, timeline.minTravelDaysExpress, timeline.expectedCompletionHours, timeline.paymentDeadlineHours, timeline.quotationResponseMinutes].filter(
          (value) => value !== null
        ).length
      : 0;
    return jsonSuccess({
      service,
      pricingRules,
      documents,
      documentsOffMaster,
      statuses,
      terms,
      timelineValues,
      countryTimelines,
      refundConfigured: Boolean(refund),
    });
  } catch (error) {
    console.error("[api/admin/service-configuration/summary]", describeError(error));
    return jsonError(500, "Couldn't load the configuration summary.");
  }
}
