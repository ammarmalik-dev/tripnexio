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
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

interface OccupationData {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";
type StatusFilter = "all" | "active" | "hidden";

function OccupationRow({
  occupation,
  onSaved,
  onDeleted,
}: {
  occupation: OccupationData;
  onSaved: (o: OccupationData) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(occupation.name);
  const [order, setOrder] = useState(String(occupation.displayOrder));
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const dirty = name.trim() !== occupation.name || (Number(order) || 0) !== occupation.displayOrder;

  const save = async (patch: Partial<Pick<OccupationData, "name" | "displayOrder" | "active">>) => {
    setBusy(true);
    setError(undefined);
    try {
      const updated = await patchJson<OccupationData>(`/api/admin/occupations/${occupation.id}`, patch);
      toast.success(`"${updated.name}" updated.`);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.name) setError(err.fieldErrors.name[0]);
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this occupation. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const reason = await confirm({
      title: `Remove occupation "${occupation.name}"?`,
      description: "This permanently deletes the occupation from the master list. To stop offering it without deleting, hide it instead.",
      confirmLabel: "Remove Occupation",
    });
    if (!reason) return;
    setBusy(true);
    try {
      await deleteJson(withReasonQuery(`/api/admin/occupations/${occupation.id}`, reason));
      toast.success(`"${occupation.name}" removed.`);
      onDeleted(occupation.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove this occupation. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink-heading">{occupation.name}</h3>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                occupation.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
              )}
            >
              {occupation.active ? "Active" : "Hidden"}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-tertiary">Order {occupation.displayOrder}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => void save({ active: !occupation.active })} disabled={busy}>
            {occupation.active ? "Hide" : "Show"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void remove()} disabled={busy}>
            Remove
          </Button>
          {dialog}
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
          <TextField label="Occupation" name={`name-${occupation.id}`} value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={busy} />
          <TextField
            label="Order"
            name={`order-${occupation.id}`}
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => void save({ name: name.trim(), displayOrder: Number(order) || 0 })} disabled={!dirty || busy}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewOccupationForm({ onCreated }: { onCreated: (o: OccupationData) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    setError(undefined);
    try {
      const created = await postJson<OccupationData>("/api/admin/occupations", { name: name.trim() });
      toast.success(`"${created.name}" added.`);
      onCreated(created);
      setName("");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.name) setError(err.fieldErrors.name[0]);
      toast.error(err instanceof ApiError ? err.message : "Couldn't add this occupation. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <TextField label="New occupation" name="new-occupation" value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={creating} />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void create()} isLoading={creating} disabled={name.trim().length < 2}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Occupation
        </Button>
      </div>
    </div>
  );
}

export function OccupationsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<OccupationData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === "active" && !item.active) return false;
      if (statusFilter === "hidden" && item.active) return false;
      if (!term) return true;
      return item.name.toLowerCase().includes(term);
    });
  }, [items, search, statusFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<OccupationData[]>("/api/admin/occupations");
        if (cancelled) return;
        setItems(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load occupations. Please try again.");
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
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load occupations"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
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
  const createOpen = showCreate || items.length === 0;
  const trimmedSearch = search.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-occupation-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Add new occupation
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-occupation-panel" className="border-t border-hairline p-5">
            <NewOccupationForm
              onCreated={(created) => {
                setItems((current) => [created, ...current]);
                clearFilters();
              }}
            />
          </div>
        ) : null}
      </section>

      {items.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search occupations"
              placeholder="Search occupation"
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
            <option value="hidden">Hidden</option>
          </select>
          <p className="shrink-0 text-xs font-medium text-ink-tertiary sm:px-2" aria-live="polite">
            {filtered.length} occupation{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="No occupations yet" description="Add the first one using the form above." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No occupations match "${trimmedSearch}"` : "No occupations match these filters"}
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
            { header: "Occupation", cell: (row) => <span className="font-medium text-ink-primary">{row.name}</span> },
            { header: "Order", cell: (row) => row.displayOrder },
          ]}
          renderEditor={(row) => (
            <OccupationRow
              occupation={row}
              onSaved={(updated) => setItems((current) => current.map((o) => (o.id === updated.id ? updated : o)))}
              onDeleted={(id) => setItems((current) => current.filter((o) => o.id !== id))}
            />
          )}
        />
      )}

      <ListPagination noun="occupation" {...paginationProps} />
    </div>
  );
}
