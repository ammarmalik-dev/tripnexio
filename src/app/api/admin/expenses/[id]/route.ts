import type { NextRequest } from "next/server";
import { updateExpenseSchema } from "@/lib/validation/expense-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("finance.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.expense.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Expense not found.");

  if (parsed.data.categoryId) {
    const category = await db.expenseCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || !category.active) {
      return jsonError(400, "Select a valid, active expense category.", { categoryId: ["This category isn't available."] });
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.expense.update({
      where: { id },
      data: {
        ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
        ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
        ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      },
      include: { category: true, recordedBy: { select: { id: true, name: true } } },
    });
    await writeAudit(tx, {
      entityType: "Expense",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Expense updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("finance.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  const existing = await db.expense.findUnique({ where: { id }, include: { category: true } });
  if (!existing) return jsonError(404, "Expense not found.");

  await db.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id } });
    await writeAudit(tx, {
      entityType: "Expense",
      entityId: id,
      action: "DELETE",
      byUserId: session.id,
      note: `₹${existing.amount} expense under "${existing.category.name}" removed (by ${session.name})`,
    });
  });

  return jsonSuccess({ id });
}
