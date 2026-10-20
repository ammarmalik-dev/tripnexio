"use client";

import { useId, useRef, type ChangeEvent } from "react";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";

/** Client doc 2026-10-20 (L1) — the coloured "Choose File" look, for upload labels that wrap their own input. */
export const FILE_BUTTON_CLASS =
  "inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-ink-on-dark-primary shadow-sm transition-opacity duration-150 hover:opacity-90 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2";

/**
 * Client doc 2026-10-20 (A9 / B5 / L1) — the one file picker used across CRM: a coloured "Choose File"
 * button (not the browser's grey control) with the chosen file's name next to it. The parent validates
 * the file (type / size) in `onFile`.
 */
export function FilePickerButton({
  accept,
  fileName,
  onFile,
  disabled,
  label = "Choose File",
  id,
  className,
}: {
  accept: string;
  fileName: string | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
  className?: string;
}) {
  const autoId = useId();
  const inputId = id ?? `file-${autoId}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFile(event.target.files?.[0] ?? null);
    // Picking the same file again still fires a change.
    event.target.value = "";
  };

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-ink-on-dark-primary shadow-sm transition-opacity duration-150 hover:opacity-90 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <Paperclip className="h-4 w-4" aria-hidden="true" />
        {label}
        <input ref={inputRef} id={inputId} type="file" accept={accept} className="sr-only" disabled={disabled} onChange={handleChange} />
      </label>
      <span className="min-w-0 truncate text-sm text-ink-secondary">{fileName ?? "No file chosen"}</span>
    </div>
  );
}
