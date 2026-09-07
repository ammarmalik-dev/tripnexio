"use client";

import { useState, type ChangeEvent } from "react";
import { useFormContext } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

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
}: {
  base64FieldName: string;
  mimeFieldName: string;
}) {
  const { setValue, watch } = useFormContext();
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasValue = Boolean(watch(base64FieldName));

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please upload a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That image is too large (8MB max).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1] ?? "";
      setValue(base64FieldName, base64, { shouldValidate: false });
      setValue(mimeFieldName, file.type, { shouldValidate: false });
      setFileName(file.name);
    };
    reader.onerror = () => setError("Couldn't read that file — please try again.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <label className="text-sm font-medium text-ink-primary" htmlFor="passport-upload">
        Passport photo (optional)
      </label>
      <p className="text-xs text-ink-tertiary">
        Attach a photo of your passport&apos;s main page and we&apos;ll pre-fill your details for our team to confirm — this speeds up processing. Completely optional.
      </p>
      <input
        id="passport-upload"
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleChange}
        className="text-sm text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-primary"
      />
      {hasValue && fileName ? (
        <span className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {fileName} attached
        </span>
      ) : null}
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </div>
  );
}
