import type { NextRequest } from "next/server";
import { createExpenseSchema } from "@/lib/validation/expense-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

/**
 * Step 28 (audit §4.8) — ADMIN.md §28's expense entries. Gated by the new
 * finance.manage permission (distinct from masters.manage, which only
 * covers the category dropdown) — ADMIN.md §29's own rule, "Internal
 * vendor cost and margin must remain Admin-only," applies just as much to
 * expense figures feeding the same P&L report.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("finance.manage");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Built as ONE `date` filter object, not two separately-spread partials —
  // spreading `{date: {gte}}` then `{date: {lte}}` into the same `where`
  // would have the second silently overwrite the first (same top-level
  // key), losing the lower bound entirely whenever both from/to are given.
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const expenses = await db.expense.findMany({
    where: Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {},
    include: { category: true, recordedBy: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });

  return jsonSuccess(expenses);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("finance.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const category = await db.expenseCategory.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category || !category.active) {
    return jsonError(400, "Select a valid, active expense category.", { categoryId: ["This category isn't available."] });
  }

  const expense = await db.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        categoryId: parsed.data.categoryId,
        amount: parsed.data.amount,
        date: new Date(parsed.data.date),
        note: parsed.data.note,
        recordedById: session.id,
      },
      include: { category: true, recordedBy: { select: { id: true, name: true } } },
    });
    await writeAudit(tx, {
      entityType: "Expense",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `₹${parsed.data.amount} expense recorded under "${category.name}"${parsed.data.note ? ` — ${parsed.data.note}` : ""} (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(expense, 201);
}
