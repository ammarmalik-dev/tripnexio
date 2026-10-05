import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { countryPagePublishBlockers, publishBlockedMessage } from "@/lib/new-visa/publish-requirements";
import { createCountryPageSchema } from "@/lib/new-visa/country-page-schema";

/** Every country page (published or not) plus the countries that don't have one yet. */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  try {
    const pages = await db.newVisaCountryPage.findMany({
      orderBy: [{ displayOrder: "asc" }, { country: { name: "asc" } }],
      include: { country: { select: { id: true, code: true, name: true, active: true } } },
    });
    const countries = await db.country.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        _count: { select: { newVisaCountryConfigs: { where: { active: true } } } },
      },
    });
    return jsonSuccess({
      pages,
      countries: countries.map((country) => ({
        id: country.id,
        code: country.code,
        name: country.name,
        active: country.active,
        activeProducts: country._count.newVisaCountryConfigs,
      })),
    });
  } catch (error) {
    console.error("[api/admin/new-visa-pages] list failed", error);
    return jsonError(500, "Couldn't load country pages. Please try again.");
  }
}

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
  const parsed = createCountryPageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  try {
    const country = await db.country.findUnique({ where: { id: data.countryId }, select: { id: true, name: true } });
    if (!country) return jsonError(400, "Please check the highlighted fields.", { countryId: ["Unknown country"] });
    if (await db.newVisaCountryPage.findUnique({ where: { countryId: data.countryId } })) {
      return jsonError(409, `${country.name} already has a page. Edit that one instead.`);
    }
    if (await db.newVisaCountryPage.findUnique({ where: { slug: data.slug } })) {
      return jsonError(400, "Please check the highlighted fields.", { slug: ["Another page already uses this URL name"] });
    }

    if (data.published) {
      const missing = await countryPagePublishBlockers({ countryId: data.countryId, whatYouNeed: data.whatYouNeed, documents: data.documents });
      if (missing.length > 0) return jsonError(400, publishBlockedMessage(missing));
    }

    const page = await db.$transaction(async (tx) => {
      const created = await tx.newVisaCountryPage.create({ data });
      await writeAudit(tx, {
        entityType: "NewVisaCountryPage",
        entityId: created.id,
        action: "CREATE",
        byUserId: session.id,
        note: `New Visa page for ${country.name} created at /services/new-visa/${created.slug}${created.published ? " (published)" : ""} (by ${session.name})`,
      });
      return created;
    });
    return jsonSuccess(page, 201);
  } catch (error) {
    console.error("[api/admin/new-visa-pages] create failed", error);
    return jsonError(500, "Couldn't create the page. Please try again.");
  }
}
