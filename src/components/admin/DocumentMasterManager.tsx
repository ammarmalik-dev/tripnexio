"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { TextField } from "@/components/forms/TextField";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { toast } from "@/components/ui/Toaster";
import { ApiError, getJson, patchJson, postJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface DocumentTypeRow {
  id: string;
  name: string;
  description: string | null;
  defaultMandatory: boolean;
  active: boolean;
  displayOrder: number;
  usedIn: number;
}

type StatusFilter = "all" | "active" | "disabled";

interface FormValues {
  name: string;
  description: string;
  defaultMandatory: boolean;
  displayOrder: string;
}

const EMPTY: FormValues = { name: "", description: "", defaultMandatory: true, displayOrder: "0" };

function DocumentForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues;
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<Record<string, string[] | undefined> | null>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const fieldErrors = await onSubmit(values);
    setErrors(fieldErrors ?? {});
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
        <TextField label="Document name" name="doc-name" required value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} error={errors.name?.[0]} disabled={saving} />
        <TextField
          label="Display order"
          name="doc-order"
          type="number"
          value={values.displayOrder}
          onChange={(event) => setValues({ ...values, displayOrder: event.target.value })}
          error={errors.displayOrder?.[0]}
          disabled={saving}
        />
      </div>
      <TextField
        label="Description"
        name="doc-description"
        placeholder="Optional — e.g. 'Colour scan of the photo page'"
        value={values.description}
        onChange={(event) => setValues({ ...values, description: event.target.value })}
        error={errors.description?.[0]}
        disabled={saving}
      />
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input type="checkbox" checked={values.defaultMandatory} disabled={saving} onChange={(event) => setValues({ ...values, defaultMandatory: event.target.checked })} />
        Mandatory by default (each country / service can still mark it optional)
      </label>
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
 * Client corrections 2026-10-05 — Admin → Document Master: one list of every
 * document definition (Mandatory / Optional by default). Countries and
 * services pick from it in Document Requirements. Create → list → open →
 * edit → save; disable instead of delete so history stays intact.
 */
export function DocumentMasterManager() {
  const [rows, setRows] = useState<DocumentTypeRow[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<DocumentTypeRow[]>("/api/admin/document-types");
        if (cancelled) return;
        setRows(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the Document Master.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => rows.filter((row) => (status === "all" ? true : status === "active" ? row.active : !row.active)), [rows, status]);
  const replace = (row: DocumentTypeRow) => setRows((current) => current.map((entry) => (entry.id === row.id ? row : entry)));

  const toPayload = (values: FormValues) => ({
    name: values.name.trim(),
    description: values.description.trim() || null,
    defaultMandatory: values.defaultMandatory,
    displayOrder: Number(values.displayOrder) || 0,
  });

  const create = async (values: FormValues) => {
    try {
      const created = await postJson<DocumentTypeRow>("/api/admin/document-types", toPayload(values));
      setRows((current) => [...current, created].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)));
      setCreating(false);
      toast.success(`"${created.name}" added to the Document Master.`);
      return null;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't add the document.");
      return error instanceof ApiError ? (error.fieldErrors ?? null) : null;
    }
  };

  const save = async (id: string, values: FormValues) => {
    try {
      const updated = await patchJson<DocumentTypeRow>(`/api/admin/document-types/${id}`, toPayload(values));
      replace(updated);
      setEditingId(null);
      toast.success("Saved.");
      return null;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the document.");
      return error instanceof ApiError ? (error.fieldErrors ?? null) : null;
    }
  };

  const toggle = async (row: DocumentTypeRow) => {
    setTogglingId(row.id);
    try {
      replace(await patchJson<DocumentTypeRow>(`/api/admin/document-types/${row.id}`, { active: !row.active }));
      toast.success(row.active ? `"${row.name}" disabled.` : `"${row.name}" enabled.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't change the status.");
    } finally {
      setTogglingId(null);
    }
  };

  if (state === "loading") return <Skeleton className="h-48 w-full" />;
  if (state === "error") return <ErrorState description={errorMessage} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          className={cn(fieldControlClass, fieldBorderClass(false), "h-10 w-auto min-w-[160px]")}
        >
          <option value="all">All ({rows.length})</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <Button type="button" size="sm" onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Document
        </Button>
      </div>

      {creating ? (
        <section className="rounded-xl border border-hairline bg-surface-1 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-heading">New document</h2>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)} aria-label="Close">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <DocumentForm initial={EMPTY} submitLabel="Add Document" onSubmit={create} onCancel={() => setCreating(false)} />
        </section>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="No documents here" description="Add a document to start the master list." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium tracking-wide text-ink-tertiary uppercase">
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3 text-right">Used in</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) =>
                editingId === row.id ? (
                  <tr key={row.id} className="border-b border-hairline bg-ink-primary/[0.02]">
                    <td colSpan={5} className="px-4 py-4">
                      <DocumentForm
                        initial={{ name: row.name, description: row.description ?? "", defaultMandatory: row.defaultMandatory, displayOrder: String(row.displayOrder) }}
                        submitLabel="Save"
                        onSubmit={(values) => save(row.id, values)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-primary">{row.name}</div>
                      {row.description ? <div className="text-xs text-ink-tertiary">{row.description}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", row.defaultMandatory ? "bg-ink-accent/10 text-ink-accent" : "bg-ink-primary/[0.06] text-ink-secondary")}>
                        {row.defaultMandatory ? "Mandatory" : "Optional"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">{row.usedIn}</td>
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
