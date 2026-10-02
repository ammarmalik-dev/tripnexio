import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { updateCountryPageSchema } from "@/lib/new-visa/country-page-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = updateCountryPageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  try {
    const existing = await db.newVisaCountryPage.findUnique({ where: { id }, include: { country: { select: { name: true } } } });
    if (!existing) return jsonError(404, "Page not found.");
    if (data.slug && data.slug !== existing.slug && (await db.newVisaCountryPage.findUnique({ where: { slug: data.slug } }))) {
      return jsonError(400, "Please check the highlighted fields.", { slug: ["Another page already uses this URL name"] });
    }

    const changed = Object.keys(data).filter((key) => key !== "published");
    const parts: string[] = [];
    if (data.published !== undefined && data.published !== existing.published) parts.push(data.published ? "published" : "unpublished");
    if (changed.length > 0) parts.push(`edited ${changed.join(", ")}`);

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.newVisaCountryPage.update({ where: { id }, data });
      await writeAudit(tx, {
        entityType: "NewVisaCountryPage",
        entityId: id,
        action: data.published !== undefined && data.published !== existing.published ? (data.published ? "PUBLISH" : "UNPUBLISH") : "UPDATE",
        byUserId: session.id,
        note: `New Visa page for ${existing.country.name} ${parts.join("; ") || "saved"} (by ${session.name})`,
      });
      return result;
    });
    return jsonSuccess(updated);
  } catch (error) {
    console.error("[api/admin/new-visa-pages] update failed", error);
    return jsonError(500, "Couldn't save the page. Please try again.");
  }
}
