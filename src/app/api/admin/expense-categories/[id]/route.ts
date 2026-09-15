import type { NextRequest } from "next/server";
import { updateExpenseCategorySchema } from "@/lib/validation/expense-category-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

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

  const parsed = updateExpenseCategorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.expenseCategory.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Expense category not found.");

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const clash = await db.expenseCategory.findUnique({ where: { name: parsed.data.name } });
    if (clash) return jsonError(400, "A category with this name already exists.", { name: ["This name is taken."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.expenseCategory.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "ExpenseCategory",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Expense category "${result.name}" updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
