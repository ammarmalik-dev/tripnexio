"use client";

import { useState, type ChangeEvent } from "react";
import { useFormContext } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { DOCUMENT_UPLOAD_ACCEPT, DOCUMENT_UPLOAD_HINT, documentUploadError } from "@/lib/uploads/document-rules";


/**
 * Optional passport-photo upload, reused across every service request flow
 * that has one (OTB, New Visa) — converts the file to base64 client-side
 * and stores it directly on the form's own `passportImageBase64`/
 * `passportImageMimeType` fields (see otb-schema.ts / new-visa-schema.ts),
 * so it rides along with the rest of the submission with no separate
 * upload request. Genuinely optional: skipping it just skips OCR
 * server-side, never blocks submission (see Phase 5D in CLAUDE.md).
 */
export function PassportUploadField({
  base64FieldName,
  mimeFieldName,
  label = "Passport photo (optional)",
  description = "Attach a photo of your passport's main page and we'll pre-fill your details for our team to confirm — this speeds up processing. Completely optional.",
  required = false,
  error: externalError,
}: {
  base64FieldName: string;
  mimeFieldName: string;
  /** Overrides the default optional-upload copy — used by flows where the upload is mandatory. */
  label?: string;
  description?: string;
  required?: boolean;
  /** Validation message from the form's own schema (e.g. "Upload a copy of the passport"). */
  error?: string;
}) {
  const { setValue, watch } = useFormContext();
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasValue = Boolean(watch(base64FieldName));
  const inputId = `upload-${base64FieldName.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    const invalid = documentUploadError(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1] ?? "";
      setValue(base64FieldName, base64, { shouldValidate: required });
      setValue(mimeFieldName, file.type, { shouldValidate: required });
      setFileName(file.name);
    };
    reader.onerror = () => setError("Couldn't read that file — please try again.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <label className="text-sm font-medium text-ink-primary" htmlFor={inputId}>
        {label}
        {required ? <span className="ml-0.5 text-error" aria-hidden="true">*</span> : null}
      </label>
      <p className="text-xs text-ink-tertiary">
        {description} ({DOCUMENT_UPLOAD_HINT})
      </p>
      <input
        id={inputId}
        aria-invalid={!!externalError}
        type="file"
        accept={DOCUMENT_UPLOAD_ACCEPT}
        onChange={handleChange}
        className="text-sm text-ink-secondary file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink-on-dark-primary hover:file:opacity-90"
      />
      {hasValue && fileName ? (
        <span className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {fileName} attached
        </span>
      ) : null}
      {error || externalError ? <span className="text-xs text-error">{error ?? externalError}</span> : null}
    </div>
  );
}
