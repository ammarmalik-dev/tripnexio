"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Paperclip, X } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { TASK_PRIORITY_OPTIONS } from "@/lib/crm/labels";
import { supportRequestSchema, type SupportRequestValues } from "@/lib/validation/support-request-schema";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

const EMPTY_VALUES: SupportRequestValues = { title: "", description: "", pageUrl: "", priority: "NORMAL" };
const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

/**
 * P22 item 2 — "Report an issue" (CRM.md §28). Client doc 16 Nov (L3): raises a help desk ticket (TNIT0001…) with
 * optional screenshots / files (images or PDF, up to 5, 8MB each) and shows its number once sent.
 */
export function ReportIssueForm({ onCreated }: { onCreated?: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [lastTicket, setLastTicket] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupportRequestValues>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: EMPTY_VALUES,
  });

  const addFiles = (picked: File[]) => {
    const problems = picked.filter((file) => !/^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/.test(file.type) || file.size > MAX_BYTES);
    const next = [...files, ...picked.filter((file) => !problems.includes(file))].slice(0, MAX_FILES);
    setFiles(next);
    setFileError(problems.length > 0 ? "Only images (PNG, JPG, WebP, GIF) or PDF, up to 8MB each." : files.length + picked.length > MAX_FILES ? "Up to 5 files." : "");
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const attachments = await Promise.all(files.map(async (file) => ({ fileName: file.name, data: await readAsBase64(file) })));
      const result = await postJson<{ ticketNumber: string }>("/api/crm/support-requests", { ...values, attachments });
      setLastTicket(result.ticketNumber);
      toast.success(`Ticket ${result.ticketNumber} raised — the admin team has been told.`);
      reset(EMPTY_VALUES);
      setFiles([]);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send your report. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {lastTicket ? (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Ticket <strong>{lastTicket}</strong> raised. You&apos;ll find it under My tickets; a confirmation email is on its way.
        </p>
      ) : null}
      <TextField label="Summary" required placeholder="e.g. Payment link button does nothing" error={errors.title?.message} {...register("title")} />
      <Textarea
        label="What happened?"
        required
        placeholder="What you were doing, what you expected, and what happened instead"
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Page / URL (optional)"
          placeholder="e.g. /crm/bookings/…"
          error={errors.pageUrl?.message}
          {...register("pageUrl")}
        />
        <FormField label="Priority" htmlFor="support-priority" error={errors.priority?.message} required>
          <select id="support-priority" className={cn(fieldControlClass, fieldBorderClass(!!errors.priority))} {...register("priority")}>
            {TASK_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-secondary">Screenshots / files (optional)</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          className="sr-only"
          aria-label="Attach screenshots or files"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => inputRef.current?.click()} disabled={files.length >= MAX_FILES || isSubmitting}>
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            Attach files
          </Button>
          {files.map((file, index) => (
            <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-ink-primary/5 px-2.5 py-1 text-xs text-ink-secondary">
              {file.name}
              <button
                type="button"
                onClick={() => setFiles((current) => current.filter((_, at) => at !== index))}
                aria-label={`Remove ${file.name}`}
                className="rounded-full p-0.5 hover:bg-ink-primary/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
        {fileError ? <p className="text-xs text-error">{fileError}</p> : <p className="text-xs text-ink-tertiary">Images or PDF, up to 5 files, 8MB each.</p>}
      </div>
      <div>
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          Send report
        </Button>
      </div>
    </form>
  );
}
