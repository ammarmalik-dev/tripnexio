"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface ExpenseCategoryData {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="flex items-center gap-2">
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium", category.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}
        >
          {category.active ? "Active" : "Disabled"}
        </span>
        <span className="text-sm font-medium text-ink-primary">{category.name}</span>
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
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Category</h2>
      <div className="flex items-end gap-3">
        <TextField label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} error={error} disabled={creating} />
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!name.trim()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
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

  return (
    <div className="flex flex-col gap-4">
      {categories.length === 0 ? (
        <EmptyState title="No expense categories yet" description="Add the first one using the form below." />
      ) : (
        categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            onSaved={(updated) => setCategories((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewCategoryForm
        nextDisplayOrder={categories.length}
        onCreated={(created) => setCategories((current) => [...current, created])}
      />
    </div>
  );
}
