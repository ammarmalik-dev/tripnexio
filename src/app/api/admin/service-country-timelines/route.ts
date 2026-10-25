import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { describeError } from "@/lib/api/describe-error";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { countryTimelineServiceSchema, upsertCountryTimelineSchema } from "@/lib/validation/service-country-timeline-schema";
import { COUNTRY_TIMELINE_FIELDS, describeCountryTimeline, type CountryTimelineRow } from "@/lib/settings/service-timeline-merge";

/**
 * Admin handover §6 — "one central Timeline Control … by service, country".
 * Per-country timelines for Return Ticket, Visa Extension, Visa Change and
 * Special Fare (Admin → Service Configuration → Timelines). A blank field
 * uses the service value (getServiceTimelineRules merges them). New Visa
 * keeps /api/admin/new-visa-timelines; OTB its per-airline TAT.
 */

export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const service = countryTimelineServiceSchema.safeParse(request.nextUrl.searchParams.get("serviceType"));
  if (!service.success) return jsonError(400, "Choose a service with country timelines.");

  try {
    const rows = await db.serviceCountryTimeline.findMany({
      where: { serviceType: service.data },
      include: { country: { select: { code: true, name: true } } },
      orderBy: { country: { name: "asc" } },
    });
    const countries = await db.country.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    });
    const data: CountryTimelineRow[] = rows.map((row) => ({
      id: row.id,
      countryId: row.countryId,
      countryCode: row.country.code,
      countryName: row.country.name,
      documentVerificationHours: row.documentVerificationHours,
      expectedCompletionHours: row.expectedCompletionHours,
      quotationResponseMinutes: row.quotationResponseMinutes,
      paymentDeadlineHours: row.paymentDeadlineHours,
      processingDaysNormal: row.processingDaysNormal,
      processingDaysExpress: row.processingDaysExpress,
      updatedAt: row.updatedAt.toISOString(),
    }));
    return jsonSuccess({ rows: data, countries });
  } catch (error) {
    console.error("[api/admin/service-country-timelines] GET", describeError(error));
    return jsonError(500, "Couldn't load the country timelines.");
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = upsertCountryTimelineSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { serviceType, countryId, reason, ...values } = parsed.data;
  if (COUNTRY_TIMELINE_FIELDS.every((field) => values[field] === null)) {
    return jsonError(400, "Fill at least one timeline for this country, or delete the country row to use the service values.");
  }

  try {
    const country = await db.country.findUnique({ where: { id: countryId }, select: { id: true, name: true } });
    if (!country) return jsonError(404, "Country not found.");
    const saved = await db.$transaction(async (tx) => {
      const existing = await tx.serviceCountryTimeline.findUnique({ where: { serviceType_countryId: { serviceType, countryId } }, select: { id: true } });
      const row = await tx.serviceCountryTimeline.upsert({
        where: { serviceType_countryId: { serviceType, countryId } },
        update: values,
        create: { serviceType, countryId, ...values },
      });
      await writeAudit(tx, {
        entityType: "ServiceCountryTimeline",
        entityId: row.id,
        action: existing ? "UPDATE" : "CREATE",
        byUserId: session.id,
        note: withReason(`${SERVICE_TYPE_LABELS[serviceType]} timeline for ${country.name}: ${describeCountryTimeline(values)} (by ${session.name})`, reason),
      });
      return row;
    });
    return jsonSuccess(saved);
  } catch (error) {
    console.error("[api/admin/service-country-timelines] PUT", describeError(error));
    return jsonError(500, "Couldn't save the country timeline.");
  }
}

/** `?id=…&reason=…` — removes a country row so that country uses the service values again. */
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError(400, "Missing country timeline id.");
  const reasonResult = await readDeleteReason(request);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  try {
    const existing = await db.serviceCountryTimeline.findUnique({ where: { id }, include: { country: { select: { name: true } } } });
    if (!existing) return jsonError(404, "Country timeline not found.");
    await db.$transaction(async (tx) => {
      await tx.serviceCountryTimeline.delete({ where: { id } });
      await writeAudit(tx, {
        entityType: "ServiceCountryTimeline",
        entityId: id,
        action: "DELETE",
        byUserId: session.id,
        note: withReason(
          `${SERVICE_TYPE_LABELS[existing.serviceType]} timeline for ${existing.country.name} removed (was ${describeCountryTimeline(existing)}) — the country now uses the service values (by ${session.name})`,
          reason
        ),
      });
    });
    return jsonSuccess({ id });
  } catch (error) {
    console.error("[api/admin/service-country-timelines] DELETE", describeError(error));
    return jsonError(500, "Couldn't remove the country timeline.");
  }
}
