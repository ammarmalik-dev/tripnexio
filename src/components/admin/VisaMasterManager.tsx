"use client";

import { useEffect, useMemo, useState } from "react";
import { ListChecks, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { TextField } from "@/components/forms/TextField";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { toast } from "@/components/ui/Toaster";
import { ApiError, getJson, patchJson, postJson } from "@/lib/api/client";
import type { VisaMasterKind } from "@/lib/visa-masters/visa-masters";
import { cn } from "@/lib/cn";

interface MasterRow {
  id: string;
  name: string;
  active: boolean;
  displayOrder: number;
  days?: number;
  description?: string | null;
  usedIn?: number;
}

interface FormValues {
  name: string;
  days: string;
  description: string;
  displayOrder: string;
}

type FieldErrors = Record<string, string[] | undefined>;

function MasterForm({
  kind,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  kind: VisaMasterKind;
  initial: FormValues;
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<FieldErrors | null>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setErrors((await onSubmit(values)) ?? {});
    setSaving(false);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Name" name="vm-name" required value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} error={errors.name?.[0]} disabled={saving} />
        {kind === "stay-types" ? (
          <TextField label="Days" name="vm-days" type="number" required value={values.days} onChange={(event) => setValues({ ...values, days: event.target.value })} error={errors.days?.[0]} disabled={saving} />
        ) : (
          <TextField label="Description" name="vm-description" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} error={errors.description?.[0]} disabled={saving} />
        )}
        <TextField label="Display order" name="vm-order" type="number" value={values.displayOrder} onChange={(event) => setValues({ ...values, displayOrder: event.target.value })} disabled={saving} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} isLoading={saving} disabled={values.name.trim().length < 2}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Client corrections 2026-10-05 — Visa Stay Type / Visa Validity Type masters:
 * one Create button, a compact table, open a row to edit, Save; disable
 * instead of delete.
 */
export function VisaMasterManager({ kind }: { kind: VisaMasterKind }) {
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const url = `/api/admin/visa-masters/${kind}`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<MasterRow[]>(`/api/admin/visa-masters/${kind}`);
        if (cancelled) return;
        setRows(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the list.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const visible = useMemo(() => rows.filter((row) => (status === "all" ? true : status === "active" ? row.active : !row.active)), [rows, status]);
  const payload = (values: FormValues) => ({
    name: values.name.trim(),
    displayOrder: Number(values.displayOrder) || 0,
    ...(kind === "stay-types" ? { days: Number(values.days) } : { description: values.description.trim() || null }),
  });
  const sort = (list: MasterRow[]) => [...list].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

  const create = async (values: FormValues) => {
    try {
      const created = await postJson<MasterRow>(url, payload(values));
      setRows((current) => sort([...current, created]));
      setCreating(false);
      toast.success(`"${created.name}" added.`);
      return null;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save.");
      return error instanceof ApiError ? (error.fieldErrors ?? null) : null;
    }
  };

  const save = async (id: string, values: FormValues) => {
    try {
      const updated = await patchJson<MasterRow>(`${url}/${id}`, payload(values));
      setRows((current) => sort(current.map((row) => (row.id === id ? { ...row, ...updated } : row))));
      setEditingId(null);
      toast.success("Saved.");
      return null;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save.");
      return error instanceof ApiError ? (error.fieldErrors ?? null) : null;
    }
  };

  const toggle = async (row: MasterRow) => {
    setTogglingId(row.id);
    try {
      const updated = await patchJson<MasterRow>(`${url}/${row.id}`, { active: !row.active });
      setRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, ...updated } : entry)));
      toast.success(row.active ? `"${row.name}" disabled.` : `"${row.name}" enabled.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't change the status.");
    } finally {
      setTogglingId(null);
    }
  };

  if (state === "loading") return <Skeleton className="h-40 w-full" />;
  if (state === "error") return <ErrorState description={errorMessage} />;

  const empty: FormValues = { name: "", days: "", description: "", displayOrder: "0" };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className={cn(fieldControlClass, fieldBorderClass(false), "h-10 w-auto min-w-[160px]")}
        >
          <option value="all">All ({rows.length})</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <Button type="button" size="sm" onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create New
        </Button>
      </div>

      {creating ? (
        <section className="rounded-xl border border-hairline bg-surface-1 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-heading">New entry</h2>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)} aria-label="Close">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <MasterForm kind={kind} initial={empty} submitLabel="Create" onSubmit={create} onCancel={() => setCreating(false)} />
        </section>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-5 w-5" aria-hidden="true" />} title="Nothing here yet" description="Use Create New to add the first entry." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium tracking-wide text-ink-tertiary uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">{kind === "stay-types" ? "Days" : "Description"}</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) =>
                editingId === row.id ? (
                  <tr key={row.id} className="border-b border-hairline bg-ink-primary/[0.02]">
                    <td colSpan={4} className="px-4 py-4">
                      <MasterForm
                        kind={kind}
                        initial={{ name: row.name, days: row.days ? String(row.days) : "", description: row.description ?? "", displayOrder: String(row.displayOrder) }}
                        submitLabel="Save"
                        onSubmit={(values) => save(row.id, values)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                    <td className="px-4 py-3 font-medium text-ink-primary">{row.name}</td>
                    <td className="px-4 py-3 text-ink-secondary">{kind === "stay-types" ? row.days : (row.description ?? "—")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", row.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
                        {row.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(row.id)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void toggle(row)} isLoading={togglingId === row.id}>
                        {row.active ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
