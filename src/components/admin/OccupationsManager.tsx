"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface OccupationData {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

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
  const [confirming, setConfirming] = useState(false);
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
    setBusy(true);
    try {
      await deleteJson(`/api/admin/occupations/${occupation.id}`);
      toast.success(`"${occupation.name}" removed.`);
      onDeleted(occupation.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove this occupation. Please try again.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:flex-row sm:items-end">
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
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            occupation.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {occupation.active ? "Active" : "Hidden"}
        </span>
        <Button type="button" size="sm" onClick={() => void save({ name: name.trim(), displayOrder: Number(order) || 0 })} disabled={!dirty || busy}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void save({ active: !occupation.active })} disabled={busy}>
          {occupation.active ? "Hide" : "Show"}
        </Button>
        {confirming ? (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Keep
            </Button>
            <Button type="button" size="sm" onClick={() => void remove()} isLoading={busy}>
              Confirm remove
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={busy}>
            Remove
          </Button>
        )}
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
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <TextField label="New occupation" name="new-occupation" value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={creating} />
      </div>
      <Button type="button" size="sm" onClick={() => void create()} isLoading={creating} disabled={name.trim().length < 2}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add
      </Button>
    </div>
  );
}

export function OccupationsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<OccupationData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

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

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <EmptyState title="No occupations yet" description="Add the first one below." />
      ) : (
        items.map((item) => (
          <OccupationRow
            key={item.id}
            occupation={item}
            onSaved={(updated) => setItems((current) => current.map((o) => (o.id === updated.id ? updated : o)))}
            onDeleted={(id) => setItems((current) => current.filter((o) => o.id !== id))}
          />
        ))
      )}
      <NewOccupationForm onCreated={(created) => setItems((current) => [...current, created])} />
    </div>
  );
}
