"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, deleteJson, ApiError } from "@/lib/api/client";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

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
  const { confirm, dialog } = useConfirmAction();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const activeCategories = categories.filter((category) => category.active);

  const handleCreate = async () => {
    const reason = await confirm({
      title: `Record a ₹${amount} expense?`,
      description: "Expenses are a financial adjustment — this changes the P&L report totals.",
      confirmLabel: "Record Expense",
    });
    if (!reason) return;
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<ExpenseData>("/api/admin/expenses", {
        categoryId,
        amount: Number(amount),
        date,
        note: note.trim() || undefined,
        reason,
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
    <div className="flex flex-col gap-4">
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
      {dialog}
    </div>
  );
}

function ExpenseRow({ expense, onDeleted }: { expense: ExpenseData; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  const handleDelete = async () => {
    const reason = await confirm({
      title: "Remove this expense?",
      description: "This permanently deletes the expense record and changes the P&L totals it feeds into.",
      confirmLabel: "Remove Expense",
    });
    if (!reason) return;
    setDeleting(true);
    try {
      await deleteJson(withReasonQuery(`/api/admin/expenses/${expense.id}`, reason));
      toast.success("Expense removed.");
      onDeleted(expense.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove this expense. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-ink-heading">{money(expense.amount)}</span>
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
      {dialog}
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
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (categoryFilter && expense.categoryId !== categoryFilter) return false;
      if (!term) return true;
      return [expense.category.name, expense.note ?? "", expense.recordedBy.name, expense.amount].some((value) =>
        value.toLowerCase().includes(term)
      );
    });
  }, [expenses, search, categoryFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

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

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    resetPage();
  };
  const createOpen = showCreate || expenses.length === 0;
  const trimmedSearch = search.trim();
  const filteredTotal = filtered.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-expense-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Record new expense
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-expense-panel" className="border-t border-hairline p-5">
            <NewExpenseForm
              categories={categories}
              onCreated={(created) => {
                setExpenses((current) => [created, ...current]);
                clearFilters();
              }}
            />
          </div>
        ) : null}
      </section>

      {expenses.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search expenses"
              placeholder="Search category, note, amount or staff"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-10 pl-9")}
            />
          </div>
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-48")}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <p className="shrink-0 text-xs font-medium text-ink-tertiary sm:px-2" aria-live="polite">
            {filtered.length} expense{filtered.length === 1 ? "" : "s"} · {money(String(filteredTotal))}
          </p>
        </div>
      ) : null}

      {expenses.length === 0 ? (
        <EmptyState title="No expenses recorded yet" description="Record the first one using the form above." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No expenses match "${trimmedSearch}"` : "No expenses match these filters"}
          description="Try a different search or filter."
          action={
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pageItems.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onDeleted={(id) => setExpenses((current) => current.filter((entry) => entry.id !== id))}
            />
          ))}
        </div>
      )}

      <ListPagination noun="expense" {...paginationProps} />
    </div>
  );
}
