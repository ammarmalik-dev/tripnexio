import type { Metadata } from "next";
import { ExpensesManager } from "@/components/admin/ExpensesManager";

export const metadata: Metadata = { title: "Expenses | Admin" };

export default function AdminExpensesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Expenses</h1>
        <p className="text-sm text-ink-tertiary">
          Operating expenses feeding the P&amp;L report. See Expense Categories to manage the dropdown options.
        </p>
      </div>
      <ExpensesManager />
    </div>
  );
}
