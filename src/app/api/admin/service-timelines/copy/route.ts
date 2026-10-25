import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { describeError } from "@/lib/api/describe-error";
import { withReason } from "@/lib/validation/sensitive-action";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { copyTimelinesSchema } from "@/lib/validation/service-country-timeline-schema";
import {
  COPYABLE_SERVICE_TIMELINE_FIELDS,
  COUNTRY_TIMELINE_FIELDS,
  describeCountryTimeline,
  type CountryTimelineOverride,
} from "@/lib/settings/service-timeline-merge";

/** A copy never touches more than this many rows in one request. */
const MAX_TARGETS = 500;

/**
 * Admin handover §3–§6 — "bulk/common apply options where the same setting is
 * needed for multiple services". One request, one transaction, one audit row
 * per target (with the confirmation reason). Targets are overwritten with the
 * source values — the Admin picks every target explicitly and confirms.
 *
 * - SERVICE: the service-wide fields every service shares (document
 *   verification, expected completion, quotation response, payment deadline,
 *   follow-up interval) → other services' Timeline rows.
 * - COUNTRY: one country timeline → other countries of the same service
 *   and/or the same countries of the other country-timeline services.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = copyTimelinesSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  try {
    if (input.mode === "SERVICE") {
      const source = await db.serviceTimelineConfig.findUnique({ where: { serviceType: input.sourceServiceType } });
      if (!source) return jsonError(404, "Save this service's timelines before copying them.");
      const targets = [...new Set(input.targetServiceTypes)].filter((serviceType) => serviceType !== input.sourceServiceType);
      if (targets.length === 0) return jsonError(400, "Choose at least one other service.");
      const values = Object.fromEntries(COPYABLE_SERVICE_TIMELINE_FIELDS.map((field) => [field, source[field]])) as Record<
        (typeof COPYABLE_SERVICE_TIMELINE_FIELDS)[number],
        number | null
      >;
      const summary = `document verification ${values.documentVerificationHours ?? "not set"}h, expected completion ${values.expectedCompletionHours ?? "not set"}h, quotation response ${values.quotationResponseMinutes ?? "not set"}min, payment deadline ${values.paymentDeadlineHours ?? "not set"}h, follow-up every ${values.followUpIntervalDays ?? "not set"} days`;

      await db.$transaction(async (tx) => {
        for (const serviceType of targets) {
          const row = await tx.serviceTimelineConfig.upsert({ where: { serviceType }, update: values, create: { serviceType, ...values } });
          await writeAudit(tx, {
            entityType: "ServiceTimelineConfig",
            entityId: row.id,
            action: "UPDATE",
            byUserId: session.id,
            note: withReason(
              `Timelines copied from ${SERVICE_TYPE_LABELS[input.sourceServiceType]} to ${SERVICE_TYPE_LABELS[serviceType]}: ${summary} (by ${session.name})`,
              input.reason
            ),
          });
        }
      });
      return jsonSuccess({ copied: targets.length });
    }

    // COUNTRY
    const source = await db.serviceCountryTimeline.findUnique({
      where: { serviceType_countryId: { serviceType: input.sourceServiceType, countryId: input.sourceCountryId } },
      include: { country: { select: { name: true } } },
    });
    if (!source) return jsonError(404, "Save this country's timeline before copying it.");
    const countryIds = [...new Set(input.targetCountryIds)];
    const countries = await db.country.findMany({ where: { id: { in: countryIds } }, select: { id: true, name: true } });
    if (countries.length !== countryIds.length) return jsonError(400, "One of the chosen countries no longer exists.");
    const nameById = new Map(countries.map((country) => [country.id, country.name]));
    const pairs = [...new Set(input.targetServiceTypes)].flatMap((serviceType) =>
      countryIds
        .filter((countryId) => !(serviceType === input.sourceServiceType && countryId === input.sourceCountryId))
        .map((countryId) => ({ serviceType, countryId }))
    );
    if (pairs.length === 0) return jsonError(400, "Choose at least one other service or country.");
    if (pairs.length > MAX_TARGETS) return jsonError(400, `That's ${pairs.length} rows — copy to at most ${MAX_TARGETS} at a time.`);
    const values = Object.fromEntries(COUNTRY_TIMELINE_FIELDS.map((field) => [field, source[field]])) as CountryTimelineOverride;
    const summary = describeCountryTimeline(values);

    await db.$transaction(async (tx) => {
      for (const { serviceType, countryId } of pairs) {
        const row = await tx.serviceCountryTimeline.upsert({
          where: { serviceType_countryId: { serviceType, countryId } },
          update: values,
          create: { serviceType, countryId, ...values },
        });
        await writeAudit(tx, {
          entityType: "ServiceCountryTimeline",
          entityId: row.id,
          action: "UPDATE",
          byUserId: session.id,
          note: withReason(
            `${SERVICE_TYPE_LABELS[serviceType]} timeline for ${nameById.get(countryId) ?? countryId} copied from ${SERVICE_TYPE_LABELS[input.sourceServiceType]} / ${source.country.name}: ${summary} (by ${session.name})`,
            input.reason
          ),
        });
      }
    }, { timeout: 60_000 });
    return jsonSuccess({ copied: pairs.length });
  } catch (error) {
    console.error("[api/admin/service-timelines/copy] POST", describeError(error));
    return jsonError(500, "Couldn't copy the timelines.");
  }
}
