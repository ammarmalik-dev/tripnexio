"use client";

import { useEffect, useMemo, useState } from "react";
import { MasterTable } from "./MasterTable";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

interface ExpenseCategoryData {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";
type StatusFilter = "all" | "active" | "disabled";

function CategoryRow({ category, onSaved }: { category: ExpenseCategoryData; onSaved: (updated: ExpenseCategoryData) => void }) {
  const [togglingActive, setTogglingActive] = useState(false);

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<ExpenseCategoryData>(`/api/admin/expense-categories/${category.id}`, { active: !category.active });
      toast.success(updated.active ? "Enabled." : "Disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this category. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-heading">{category.name}</h3>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              category.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
            )}
          >
            {category.active ? "Active" : "Disabled"}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-tertiary">Order {category.displayOrder}</p>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
        {category.active ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}

function NewCategoryForm({ nextDisplayOrder, onCreated }: { nextDisplayOrder: number; onCreated: (category: ExpenseCategoryData) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const created = await postJson<ExpenseCategoryData>("/api/admin/expense-categories", { name, displayOrder: nextDisplayOrder });
      toast.success(`Category "${created.name}" added.`);
      onCreated(created);
      setName("");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.name) setError(err.fieldErrors.name[0]);
      toast.error(err instanceof ApiError ? err.message : "Couldn't add this category. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <TextField label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} error={error} disabled={creating} />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!name.trim()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Category
        </Button>
      </div>
    </div>
  );
}

/** Step 28 (audit §4.8) — ADMIN.md §28's Admin-managed expense-category dropdown ("add/disable/reorder"; reorder not built this round — the 16 locked starter categories are seeded in a sensible default order already). */
export function ExpenseCategoriesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [categories, setCategories] = useState<ExpenseCategoryData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories.filter((category) => {
      if (statusFilter === "active" && !category.active) return false;
      if (statusFilter === "disabled" && category.active) return false;
      if (!term) return true;
      return category.name.toLowerCase().includes(term);
    });
  }, [categories, search, statusFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<ExpenseCategoryData[]>("/api/admin/expense-categories");
        if (cancelled) return;
        setCategories(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load expense categories. Please try again.");
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
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load expense categories"
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
    setStatusFilter("all");
    resetPage();
  };
  const createOpen = showCreate || categories.length === 0;
  const trimmedSearch = search.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-expense-category-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Add new category
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-expense-category-panel" className="border-t border-hairline p-5">
            <NewCategoryForm
              nextDisplayOrder={categories.length}
              onCreated={(created) => {
                setCategories((current) => [created, ...current]);
                clearFilters();
              }}
            />
          </div>
        ) : null}
      </section>

      {categories.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search expense categories"
              placeholder="Search category"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-10 pl-9")}
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-36")}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <p className="shrink-0 text-xs font-medium text-ink-tertiary sm:px-2" aria-live="polite">
            {filtered.length} categor{filtered.length === 1 ? "y" : "ies"}
          </p>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState title="No expense categories yet" description="Add the first one using the form above." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No categories match "${trimmedSearch}"` : "No categories match these filters"}
          description="Try a different search or filter."
          action={
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <MasterTable
          rows={pageItems}
          minWidth={560}
          columns={[
            { header: "Expense Category", cell: (row) => <span className="font-medium text-ink-primary">{row.name}</span> },
            { header: "Order", cell: (row) => row.displayOrder },
          ]}
          renderEditor={(category) => (
            <CategoryRow
              category={category}
              onSaved={(updated) => setCategories((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
            />
          )}
        />
      )}

      <ListPagination noun="category record" {...paginationProps} />
    </div>
  );
}
