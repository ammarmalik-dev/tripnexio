import type { NextRequest } from "next/server";
import { createFaqSchema } from "@/lib/validation/faq-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const faqs = await db.faq.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] });
  return jsonSuccess(faqs);
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

  const parsed = createFaqSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const faq = await db.$transaction(async (tx) => {
    const created = await tx.faq.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "Faq",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `FAQ "${created.question}" created (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(faq, 201);
}
