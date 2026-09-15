"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface CategoryOption {
  id: string;
  name: string;
  active: boolean;
}

interface ExpenseData {
  id: string;
  categoryId: string;
  amount: string;
  date: string;
  note: string | null;
  category: { id: string; name: string };
  recordedBy: { id: string; name: string };
}

type FetchState = "loading" | "success" | "error";

function money(value: string): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function NewExpenseForm({ categories, onCreated }: { categories: CategoryOption[]; onCreated: (expense: ExpenseData) => void }) {
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const activeCategories = categories.filter((category) => category.active);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<ExpenseData>("/api/admin/expenses", {
        categoryId,
        amount: Number(amount),
        date,
        note: note.trim() || undefined,
      });
      toast.success(`${money(created.amount)} expense recorded.`);
      onCreated(created);
      setCategoryId("");
      setAmount("");
      setNote("");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't record this expense. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = categoryId && amount && Number(amount) > 0 && date;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Record Expense</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Category" htmlFor="expense-category" error={errors.categoryId?.[0]}>
          <select
            id="expense-category"
            value={categoryId}
            disabled={creating}
            onChange={(event) => setCategoryId(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.categoryId))}
          >
            <option value="" disabled>
              Select a category
            </option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>
        <TextField
          label="Amount (₹)"
          name="amount"
          type="number"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={errors.amount?.[0]}
          disabled={creating}
        />
        <TextField
          label="Date"
          name="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          error={errors.date?.[0]}
          disabled={creating}
        />
        <TextField
          label="Note"
          name="note"
          placeholder="Optional"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={creating}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Record Expense
        </Button>
      </div>
    </div>
  );
}

function ExpenseRow({ expense, onDeleted }: { expense: ExpenseData; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteJson(`/api/admin/expenses/${expense.id}`);
      toast.success("Expense removed.");
      onDeleted(expense.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove this expense. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-heading">{money(expense.amount)}</span>
          <span className="rounded-full bg-ink-primary/[0.06] px-2 py-0.5 text-xs text-ink-tertiary">{expense.category.name}</span>
        </div>
        <span className="text-xs text-ink-tertiary">
          {formatDate(expense.date)} · recorded by {expense.recordedBy.name}
          {expense.note ? ` · ${expense.note}` : ""}
        </span>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete()} isLoading={deleting}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Remove
      </Button>
    </div>
  );
}

/** Step 28 (audit §4.8) — ADMIN.md §28's expense log. Create + delete only, matching StaffLeave's precedent for short-lived reference-style records. */
export function ExpensesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [expenseResult, categoryResult] = await Promise.all([
          getJson<ExpenseData[]>("/api/admin/expenses"),
          getJson<CategoryOption[]>("/api/admin/expense-categories"),
        ]);
        if (cancelled) return;
        setExpenses(expenseResult);
        setCategories(categoryResult);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load expenses. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load expenses"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {expenses.length === 0 ? (
        <EmptyState title="No expenses recorded yet" description="Record the first one using the form below." />
      ) : (
        expenses.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} onDeleted={(id) => setExpenses((current) => current.filter((entry) => entry.id !== id))} />
        ))
      )}
      <NewExpenseForm categories={categories} onCreated={(created) => setExpenses((current) => [created, ...current])} />
    </div>
  );
}
