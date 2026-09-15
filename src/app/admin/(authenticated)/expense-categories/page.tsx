import type { Metadata } from "next";
import { ExpenseCategoriesManager } from "@/components/admin/ExpenseCategoriesManager";

export const metadata: Metadata = { title: "Expense Categories | Admin" };

export default function AdminExpenseCategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Expense Categories</h1>
        <p className="text-sm text-ink-tertiary">
          The dropdown options staff pick from when recording an expense. Seeded with ADMIN.md&apos;s own locked
          starter list — add or disable more as needed.
        </p>
      </div>
      <ExpenseCategoriesManager />
    </div>
  );
}
