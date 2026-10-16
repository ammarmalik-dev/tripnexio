import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { SITE_PAGE_DEFS, isSitePage } from "@/lib/site-content/pages";
import { sitePageImageUrl } from "@/lib/site-content/get-page-content";

interface RouteParams {
  params: Promise<{ page: string }>;
}

/** Client doc 2026-10-15 (J3) — a website page's photo and Admin-edited wording (blank = original copy). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { page } = await params;
  if (!isSitePage(page)) return jsonError(404, "Unknown page.");
  const row = await db.sitePageContent.findUnique({ where: { page } });
  const fields = row?.fields && typeof row.fields === "object" && !Array.isArray(row.fields) ? (row.fields as Record<string, string>) : {};
  return jsonSuccess({ page, fields, heroImageUrl: sitePageImageUrl(row?.heroImageFileId), updatedAt: row?.updatedAt ?? null });
}

const bodySchema = z.object({ fields: z.record(z.string(), z.string().max(2000, "Keep this under 2,000 characters")) });

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { page } = await params;
  if (!isSitePage(page)) return jsonError(404, "Unknown page.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  // Only this page's known fields; blank values are dropped so the page shows its original copy.
  const allowed = new Set(SITE_PAGE_DEFS[page].fields.map((field) => field.key as string));
  const fields = Object.fromEntries(
    Object.entries(parsed.data.fields)
      .filter(([key]) => allowed.has(key))
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value)
  );

  try {
    const before = await db.sitePageContent.findUnique({ where: { page }, select: { fields: true } });
    const previous = (before?.fields ?? {}) as Record<string, unknown>;
    const changed = [...new Set([...Object.keys(previous), ...Object.keys(fields)])].filter((key) => (previous[key] ?? "") !== (fields[key] ?? ""));
    await db.$transaction(async (tx) => {
      await tx.sitePageContent.upsert({
        where: { page },
        create: { page, fields: fields as Prisma.InputJsonObject, updatedByUserId: session.id },
        update: { fields: fields as Prisma.InputJsonObject, updatedByUserId: session.id },
      });
      await writeAudit(tx, {
        entityType: "SitePageContent",
        entityId: page,
        action: "UPDATE",
        byUserId: session.id,
        note: `Website page "${SITE_PAGE_DEFS[page].label}" wording saved${changed.length ? ` (${changed.join(", ")})` : " (no changes)"} (by ${session.name})`,
      });
    });
    revalidatePath(SITE_PAGE_DEFS[page].path);
    return jsonSuccess({ page, fields });
  } catch (error) {
    console.error("[api/admin/site-pages] save failed", describeError(error));
    return jsonError(500, "Couldn't save the page. Please try again.");
  }
}
