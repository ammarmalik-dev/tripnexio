import type { NextRequest } from "next/server";
import { createExpenseCategorySchema } from "@/lib/validation/expense-category-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

/** Step 28 (audit §4.8) — ADMIN.md §28's Admin-managed expense-category dropdown. Same masters.manage gate as every other reference-data screen. */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const categories = await db.expenseCategory.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  return jsonSuccess(categories);
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

  const parsed = createExpenseCategorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.expenseCategory.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return jsonError(400, "A category with this name already exists.", { name: ["This name is taken."] });
  }

  const category = await db.$transaction(async (tx) => {
    const created = await tx.expenseCategory.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "ExpenseCategory",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Expense category "${created.name}" added (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(category, 201);
}
