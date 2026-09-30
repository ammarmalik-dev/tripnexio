import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { updateProtectionPlanCountrySchema } from "@/lib/validation/protection-plan-config-schema";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

interface RouteParams {
  params: Promise<{ countryId: string }>;
}

/**
 * P12 — enable/disable Protection Plan for one destination country, with an
 * optional price and terms override (empty = the global default). Only
 * affects new bookings: plans already offered or purchased keep their
 * snapshotted price.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { countryId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = updateProtectionPlanCountrySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const country = await db.country.findUnique({ where: { id: countryId }, include: { protectionPlanCountry: true } });
  if (!country) return jsonError(404, "Country not found.");

  const before = country.protectionPlanCountry;

  // Business Rules §14 "Sensitive Admin Actions" — a price change needs the confirmation reason; enable/disable and terms edits don't.
  const priceChanged =
    parsed.data.price !== undefined && (before?.price == null ? null : Number(before.price)) !== parsed.data.price;
  const reasonResult = readBodyReason(body);
  if (priceChanged && reasonResult.error) return reasonResult.error;
  const reason = reasonResult.reason ?? null;
  const data = {
    ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
    ...(parsed.data.termsText !== undefined ? { termsText: parsed.data.termsText } : {}),
  };

  try {
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.protectionPlanCountry.upsert({
        where: { countryId },
        create: { countryId, enabled: false, ...data },
        update: data,
      });
      const changes = [
        before?.enabled !== row.enabled ? `enabled ${before?.enabled ?? false} -> ${row.enabled}` : null,
        String(before?.price ?? "") !== String(row.price ?? "") ? `price ${before?.price ?? "default"} -> ${row.price ?? "default"}` : null,
        (before?.termsText ?? null) !== row.termsText ? "terms override updated" : null,
      ].filter(Boolean);
      const auditNote = `Protection Plan for ${country.name}: ${changes.join(", ") || "no change"} (by ${session.name})`;
      await writeAudit(tx, {
        entityType: "ProtectionPlanCountry",
        entityId: row.id,
        action: "UPDATE",
        byUserId: session.id,
        note: reason ? withReason(auditNote, reason) : auditNote,
      });
      return row;
    });

    return jsonSuccess({
      countryId,
      enabled: updated.enabled,
      price: updated.price?.toString() ?? null,
      termsText: updated.termsText,
    });
  } catch (error) {
    console.error("[api/admin/protection-plan-countries/[countryId]]", error);
    return jsonError(500, "Couldn't save the country setting.");
  }
}
