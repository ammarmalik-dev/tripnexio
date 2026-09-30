"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { Download, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/forms/Textarea";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { csvHeaderLine } from "@/lib/csv/parse-csv";
import {
  IMPORT_SPECS,
  type ImportCommitResult,
  type ImportEntityKey,
  type ImportPreviewResult,
  type ImportRowResult,
} from "@/lib/csv/import-specs";
import { cn } from "@/lib/cn";

const ACTION_BADGE: Record<ImportRowResult["action"], { label: string; className: string }> = {
  create: { label: "Create", className: "bg-success/10 text-success" },
  update: { label: "Update", className: "bg-ink-accent/10 text-ink-accent" },
  error: { label: "Error", className: "bg-error/10 text-error" },
};

export interface CsvImportPanelProps {
  entity: ImportEntityKey;
  /** Called after a successful commit (e.g. to refetch the manager's list). Defaults to offering a page reload. */
  onImported?: () => void;
}

/**
 * P26 — reusable CSV import with a validation preview, backed by
 * /api/admin/import/[entity]: upload/paste → Preview (server parses and
 * validates every row, nothing written) → review create/update/error per
 * row → Import (server re-validates and applies only the valid rows in one
 * transaction). Sensitive imports (prices, vendors, document requirements)
 * ask for a Business Rules §14 confirmation reason before committing.
 * Collapsed by default so it doesn't crowd the manager it's mounted above.
 */
export function CsvImportPanel({ entity, onImported }: CsvImportPanelProps) {
  const spec = IMPORT_SPECS[entity];
  const baseId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirmAction();
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [committed, setCommitted] = useState<ImportCommitResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [requestError, setRequestError] = useState("");

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvHeaderLine(spec.columns.map((column) => column.name)))}`;
  const validCount = preview ? preview.totals.create + preview.totals.update : 0;

  const resetResults = () => {
    setPreview(null);
    setCommitted(null);
    setRequestError("");
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(typeof reader.result === "string" ? reader.result : "");
      setFilename(file.name);
      resetResults();
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    setBusy("preview");
    resetResults();
    try {
      const data = await postJson<ImportPreviewResult>(`/api/admin/import/${entity}`, { mode: "preview", csv, filename: filename ?? undefined });
      setPreview(data);
      if (data.totals.error > 0) toast.error(`${data.totals.error} row(s) have errors — they'll be skipped unless fixed.`);
      else toast.success(`All ${data.rows.length} row(s) are valid.`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Couldn't preview this file. Please try again.";
      setRequestError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const handleCommit = async () => {
    if (!preview || validCount === 0) return;
    let reason: string | undefined;
    if (spec.sensitive) {
      const confirmed = await confirm({
        title: `Import ${spec.label.toLowerCase()}?`,
        description: (
          <>
            {preview.totals.create} will be created and {preview.totals.update} updated
            {preview.totals.error > 0 ? `; ${preview.totals.error} row(s) with errors will be skipped` : ""}. The file is
            re-validated on the server before anything is written.
          </>
        ),
        confirmLabel: "Import",
      });
      if (!confirmed) return;
      reason = confirmed;
    }

    setBusy("commit");
    setRequestError("");
    try {
      const data = await postJson<ImportCommitResult>(`/api/admin/import/${entity}`, {
        mode: "commit",
        csv,
        filename: filename ?? undefined,
        ...(reason ? { reason } : {}),
      });
      setCommitted(data);
      setPreview(null);
      toast.success(`Import finished: ${data.created} created, ${data.updated} updated${data.skipped ? `, ${data.skipped} skipped` : ""}.`);
      onImported?.();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Couldn't import this file. Please try again.";
      setRequestError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const rows = committed?.rows ?? preview?.rows ?? [];

  return (
    <details className="group rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <summary className="cursor-pointer text-sm font-semibold text-ink-heading focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        Bulk Import {spec.label} (CSV)
      </summary>

      <div className="mt-4 flex flex-col gap-3">
        <p className="text-xs text-ink-tertiary">
          Existing rows are matched by {spec.matchedBy} and updated; everything else is created. Blank optional cells keep the
          default (new rows) or the current value (existing rows). Nothing is written until you review the preview and click
          Import.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <caption className="sr-only">{spec.label} import columns</caption>
            <thead className="text-ink-tertiary">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">Column</th>
                <th scope="col" className="py-1 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="text-ink-secondary">
              {spec.columns.map((column) => (
                <tr key={column.name} className="border-t border-hairline">
                  <td className="py-1 pr-3 align-top">
                    <code>{column.name}</code>
                    {column.required ? <span className="ml-1 text-error" aria-label="required">*</span> : null}
                  </td>
                  <td className="py-1 align-top">{column.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <a
          href={templateHref}
          download={`${entity}-import-template.csv`}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-ink-accent underline"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download template (headers only)
        </a>

        <label htmlFor={`${baseId}-file`} className="sr-only">
          Upload {spec.label.toLowerCase()} CSV
        </label>
        <input
          ref={fileInputRef}
          id={`${baseId}-file`}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="text-sm text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-primary"
        />
        <Textarea
          label="Or paste CSV"
          name={`${baseId}-csv`}
          rows={5}
          placeholder={csvHeaderLine(spec.columns.map((column) => column.name)).trim()}
          value={csv}
          onChange={(event) => {
            setCsv(event.target.value);
            setFilename(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            resetResults();
          }}
        />

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => void handlePreview()} isLoading={busy === "preview"} disabled={!csv.trim() || busy !== null}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            Preview
          </Button>
          <Button type="button" size="sm" onClick={() => void handleCommit()} isLoading={busy === "commit"} disabled={!preview || validCount === 0 || busy !== null}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {preview ? `Import ${validCount} valid row(s)` : "Import"}
          </Button>
        </div>

        {requestError ? (
          <p role="alert" className="rounded-lg bg-error/10 p-3 text-xs text-error">
            {requestError}
          </p>
        ) : null}

        {preview || committed ? (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4 text-sm text-ink-secondary" aria-live="polite">
            {committed ? (
              <p>
                Imported{committed.filename ? ` "${committed.filename}"` : ""}: {committed.created} created · {committed.updated} updated ·{" "}
                {committed.skipped} skipped.{" "}
                {onImported ? null : (
                  <button type="button" className="text-xs font-medium text-ink-accent underline" onClick={() => window.location.reload()}>
                    Reload list
                  </button>
                )}
              </p>
            ) : preview ? (
              <p>
                Preview: {preview.totals.create} to create · {preview.totals.update} to update · {preview.totals.error} with errors
                {preview.totals.error > 0 ? " (skipped on import)" : ""}.
              </p>
            ) : null}

            {rows.length > 0 ? (
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[32rem] text-left text-xs">
                  <caption className="sr-only">Row-by-row import result</caption>
                  <thead className="sticky top-0 bg-surface-2 text-ink-tertiary">
                    <tr>
                      <th scope="col" className="py-1 pr-3 font-medium">Line</th>
                      <th scope="col" className="py-1 pr-3 font-medium">Row</th>
                      <th scope="col" className="py-1 pr-3 font-medium">Action</th>
                      <th scope="col" className="py-1 font-medium">Problems</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.line} className="border-t border-hairline align-top">
                        <td className="py-1 pr-3">{row.line}</td>
                        <td className="py-1 pr-3 break-words">{row.key}</td>
                        <td className="py-1 pr-3">
                          <span className={cn("rounded-full px-2 py-0.5 font-medium", ACTION_BADGE[row.action].className)}>
                            {committed && row.action === "error" ? "Skipped" : ACTION_BADGE[row.action].label}
                          </span>
                        </td>
                        <td className="py-1 text-error">
                          {row.errors.length > 0 ? (
                            <ul className="list-disc pl-4">
                              {row.errors.map((message, index) => (
                                <li key={index}>{message}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {dialog}
    </details>
  );
}
