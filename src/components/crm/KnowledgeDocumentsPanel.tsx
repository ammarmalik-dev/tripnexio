"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Eye, FileText, Trash2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ConfirmActionDialog } from "@/components/crm/ConfirmActionDialog";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { toast } from "@/components/ui/Toaster";
import { ApiError, deleteJson, getJson } from "@/lib/api/client";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { cn } from "@/lib/cn";

interface KnowledgeDocumentRow {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: "SOP" | "STAFF_FAQ" | "TRAINING" | null;
  createdAt: string;
  uploadedBy: string | null;
}

interface QueuedUpload {
  key: string;
  name: string;
  progress: number;
  state: "waiting" | "uploading" | "done" | "failed";
  message?: string;
}

const CATEGORY_LABELS = { SOP: "SOP / documentation", STAFF_FAQ: "Staff FAQ", TRAINING: "Training" } as const;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function typeLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/msword") return "DOC";
  return "DOCX";
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Quick browser-side check (the server re-checks the real type from the bytes). */
function precheck(file: File): string | null {
  if (!/\.(pdf|docx?)$/i.test(file.name)) return "Only PDF, DOC or DOCX.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_BYTES) return "Larger than 10MB.";
  return null;
}

/** One file per request with real upload progress (fetch can't report it). */
function uploadOne(file: File, category: string, onProgress: (percent: number) => void): Promise<KnowledgeDocumentRow> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    if (category) form.append("category", category);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/knowledge-documents");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as { data?: KnowledgeDocumentRow; error?: { message?: string } };
        if (xhr.status >= 200 && xhr.status < 300 && body.data) resolve(body.data);
        else reject(new Error(body.error?.message ?? "Upload failed."));
      } catch {
        reject(new Error("Upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Network error — check the connection and retry."));
    xhr.send(form);
  });
}

/**
 * Client doc 16 Nov (L4) — Knowledge Centre documents: bulk upload of PDF / DOC / DOCX with each file's progress and
 * result, then view, download and delete (delete needs a reason and is audited).
 */
export function KnowledgeDocumentsPanel({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<KnowledgeDocumentRow[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<KnowledgeDocumentRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = queue.some((item) => item.state === "uploading" || item.state === "waiting");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<KnowledgeDocumentRow[]>("/api/knowledge-documents");
        if (cancelled) return;
        setRows(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the documents.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? rows.filter((row) => `${row.title} ${row.fileName}`.toLowerCase().includes(query)) : rows;
  }, [rows, search]);

  const patchItem = (key: string, patch: Partial<QueuedUpload>) => setQueue((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const startUploads = async (files: File[]) => {
    const items = files.map((file, index) => {
      const problem = precheck(file);
      return { file, item: { key: `${Date.now()}-${index}-${file.name}`, name: file.name, progress: 0, state: problem ? ("failed" as const) : ("waiting" as const), message: problem ?? undefined } };
    });
    setQueue(items.map(({ item }) => item));
    let done = 0;
    let failed = items.filter(({ item }) => item.state === "failed").length;
    // One after another: steady progress, and a big batch never floods the server.
    for (const { file, item } of items) {
      if (item.state === "failed") continue;
      patchItem(item.key, { state: "uploading" });
      try {
        const created = await uploadOne(file, category, (progress) => patchItem(item.key, { progress }));
        patchItem(item.key, { state: "done", progress: 100 });
        setRows((current) => [created, ...current]);
        done += 1;
      } catch (error) {
        patchItem(item.key, { state: "failed", message: error instanceof Error ? error.message : "Upload failed." });
        failed += 1;
      }
    }
    if (done > 0) toast.success(`${done} ${done === 1 ? "document" : "documents"} uploaded.`);
    if (failed > 0) toast.error(`${failed} ${failed === 1 ? "file" : "files"} couldn't be uploaded — see the list.`);
  };

  const confirmDelete = async (reason: string) => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await deleteJson(withReasonQuery(`/api/knowledge-documents/${deleting.id}`, reason));
      setRows((current) => current.filter((row) => row.id !== deleting.id));
      toast.success(`"${deleting.title}" deleted.`);
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete the document.");
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <section aria-labelledby="knowledge-documents-heading" className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="knowledge-documents-heading" className="text-base font-semibold text-ink-heading">
            Documents
          </h2>
          <p className="text-sm text-ink-tertiary">PDF, DOC and DOCX files for the team — up to 10MB each.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="knowledge-documents-search" className="sr-only">
            Search documents
          </label>
          <input
            id="knowledge-documents-search"
            type="search"
            placeholder="Search documents"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-48 text-sm")}
          />
          {canEdit ? (
            <>
              <label htmlFor="knowledge-documents-category" className="sr-only">
                Category for new uploads
              </label>
              <select
                id="knowledge-documents-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={busy}
                className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto text-sm")}
              >
                <option value="">No category</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                aria-label="Choose documents to upload"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length > 0) void startUploads(files);
                }}
              />
              <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={busy} isLoading={busy}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload files
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {queue.length > 0 ? (
        <ul aria-label="Upload progress" className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-2 p-3">
          {queue.map((item) => (
            <li key={item.key} className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-ink-primary">{item.name}</span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 text-xs font-medium",
                    item.state === "done" ? "text-success" : item.state === "failed" ? "text-error" : "text-ink-tertiary"
                  )}
                >
                  {item.state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                  {item.state === "failed" ? <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                  {item.state === "done" ? "Uploaded" : item.state === "failed" ? (item.message ?? "Failed") : item.state === "waiting" ? "Waiting" : `${item.progress}%`}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-ink-primary/10"
                role="progressbar"
                aria-label={`${item.name} upload progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.state === "done" ? 100 : item.progress}
              >
                <div
                  className={cn("h-full rounded-full transition-[width] motion-reduce:transition-none", item.state === "failed" ? "bg-error" : item.state === "done" ? "bg-success" : "bg-accent")}
                  style={{ width: `${item.state === "failed" ? 100 : item.state === "done" ? 100 : item.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {state === "loading" ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load the documents"
          description={errorMessage}
          action={
            <Button type="button" size="sm" variant="ghost" onClick={() => setReloadNonce((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          title={rows.length === 0 ? "No documents yet" : "No documents match"}
          description={rows.length === 0 ? (canEdit ? "Use Upload files to add several at once." : "Documents the admin uploads appear here.") : "Try another search."}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium tracking-wide text-ink-tertiary uppercase">
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-hairline last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="block font-medium text-ink-primary">{row.title}</span>
                    <span className="block text-xs text-ink-tertiary">{row.fileName}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-ink-secondary">
                    {typeLabel(row.mimeType)} · {sizeLabel(row.sizeBytes)}
                  </td>
                  <td className="px-3 py-2 text-ink-secondary">{row.category ? CATEGORY_LABELS[row.category] : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-ink-secondary">
                    {new Date(row.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {row.uploadedBy ? <span className="block text-xs text-ink-tertiary">{row.uploadedBy}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {row.mimeType === "application/pdf" ? (
                      <a href={`/api/knowledge-documents/${row.id}/file`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-accent hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        View
                      </a>
                    ) : null}
                    <a href={`/api/knowledge-documents/${row.id}/file?download=1`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-accent hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </a>
                    {canEdit ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setDeleting(row)} aria-label={`Delete ${row.title}`}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleting ? (
        <ConfirmActionDialog
          title={`Delete "${deleting.title}"?`}
          description="The file is removed for everyone and can't be recovered. Your reason is saved in the audit log."
          confirmLabel="Delete document"
          pending={deletePending}
          onConfirm={(reason) => void confirmDelete(reason)}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
