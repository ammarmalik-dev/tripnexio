import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { legalPageSchema } from "@/lib/legal/legal-page-schema";
import { LEGAL_PAGE_META, isLegalPageSlug } from "@/lib/legal/pages";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/** Save a page's copy (creates the edited row on first save). The public page refreshes immediately. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { slug } = await params;
  if (!isLegalPageSlug(slug)) return jsonError(404, "Page not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = legalPageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const saved = await db.$transaction(async (tx) => {
      const row = await tx.legalPage.upsert({
        where: { slug },
        create: { slug, ...parsed.data, updatedById: session.id },
        update: { ...parsed.data, updatedById: session.id },
      });
      await writeAudit(tx, {
        entityType: "LegalPage",
        entityId: slug,
        action: "UPDATE",
        byUserId: session.id,
        note: `${LEGAL_PAGE_META[slug].label} page updated (by ${session.name})`,
      });
      return row;
    });
    revalidatePath(LEGAL_PAGE_META[slug].path);
    return jsonSuccess(saved);
  } catch (error) {
    console.error("[api/admin/legal-pages] save failed", error);
    return jsonError(500, "Couldn't save the page. Please try again.");
  }
}

/** "Reset to original": removes the edited copy so the page shows its original locked text again. Needs a reason. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { slug } = await params;
  if (!isLegalPageSlug(slug)) return jsonError(404, "Page not found.");

  const reasonResult = await readDeleteReason(request);
  if (reasonResult.error) return reasonResult.error;

  try {
    await db.$transaction(async (tx) => {
      await tx.legalPage.deleteMany({ where: { slug } });
      await writeAudit(tx, {
        entityType: "LegalPage",
        entityId: slug,
        action: "RESET",
        byUserId: session.id,
        note: withReason(`${LEGAL_PAGE_META[slug].label} page reset to the original copy (by ${session.name})`, reasonResult.reason),
      });
    });
    revalidatePath(LEGAL_PAGE_META[slug].path);
    return jsonSuccess({ slug, reset: true });
  } catch (error) {
    console.error("[api/admin/legal-pages] reset failed", error);
    return jsonError(500, "Couldn't reset the page. Please try again.");
  }
}
