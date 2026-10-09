import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { describeError } from "@/lib/api/describe-error";

/**
 * Client testing 2026-10-09 (B31) — New Visa timelines per destination
 * country (Admin → Service Configuration → Timelines). One row per country
 * that has a New Visa product; an empty field uses the service-wide value.
 */
interface NewVisaCountryTimelineRow {
  countryId: string;
  countryCode: string;
  countryName: string;
  minTravelDaysNormal: number | null;
  minTravelDaysExpress: number | null;
  processingDaysNormal: number | null;
  processingDaysExpress: number | null;
}

const days = z.number().int().min(0).max(365).nullable();
const updateSchema = z.object({
  countryId: z.string().min(1),
  minTravelDaysNormal: days,
  minTravelDaysExpress: days,
  processingDaysNormal: days,
  processingDaysExpress: days,
});

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  try {
    const countries = await db.country.findMany({
      where: { newVisaCountryConfigs: { some: {} } },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, newVisaTimeline: true },
    });
    const rows: NewVisaCountryTimelineRow[] = countries.map((country) => ({
      countryId: country.id,
      countryCode: country.code,
      countryName: country.name,
      minTravelDaysNormal: country.newVisaTimeline?.minTravelDaysNormal ?? null,
      minTravelDaysExpress: country.newVisaTimeline?.minTravelDaysExpress ?? null,
      processingDaysNormal: country.newVisaTimeline?.processingDaysNormal ?? null,
      processingDaysExpress: country.newVisaTimeline?.processingDaysExpress ?? null,
    }));
    return jsonSuccess(rows);
  } catch (error) {
    console.error("[api/admin/new-visa-timelines] GET", describeError(error));
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { countryId, ...values } = parsed.data;

  try {
    const country = await db.country.findUnique({ where: { id: countryId }, select: { id: true, name: true } });
    if (!country) return jsonError(404, "Country not found.");
    const saved = await db.$transaction(async (tx) => {
      const row = await tx.newVisaCountryTimeline.upsert({ where: { countryId }, update: values, create: { countryId, ...values } });
      const show = (value: number | null) => (value === null ? "default" : String(value));
      await writeAudit(tx, {
        entityType: "NewVisaCountryTimeline",
        entityId: row.id,
        action: "UPDATE",
        byUserId: session.id,
        note: `New Visa timeline for ${country.name}: min days before travel Normal ${show(values.minTravelDaysNormal)} / Express ${show(values.minTravelDaysExpress)}, processing days Normal ${show(values.processingDaysNormal)} / Express ${show(values.processingDaysExpress)} (by ${session.name})`,
      });
      return row;
    });
    return jsonSuccess(saved);
  } catch (error) {
    console.error("[api/admin/new-visa-timelines] PUT", describeError(error));
    return jsonError(500, "Couldn't save the country timeline.");
  }
}
