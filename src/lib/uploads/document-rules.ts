/**
 * Client doc 2026-10-15 (I8) — every customer document upload (passport, visa
 * copy, requested documents) is a PDF, PNG or JPG under 3MB, on the website,
 * the customer account, the pay / quote pages and the CRM. Shared by the
 * browser checks and the server routes.
 */
export const DOCUMENT_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const DOCUMENT_UPLOAD_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
/**
 * Client doc 2026-10-27 (D1) — the MIME types a form's `*MimeType` field may carry with its base64 upload. It must
 * include PDF: the picker accepts PDF (above), and an image-only enum here made every PDF passport / visa copy fail the
 * shared zod schema on Submit, so the website forms could not be submitted. The server still sniffs the real bytes
 * (rejectInvalidDocumentUploads) — this is only the declared type.
 */
export const UPLOAD_FIELD_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"] as const;
export const DOCUMENT_UPLOAD_ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
export const DOCUMENT_UPLOAD_HINT = "PDF, PNG or JPG, under 3MB";

/** Browser-side check before reading a file; returns an error message or null. */
export function documentUploadError(file: File): string | null {
  if (!(DOCUMENT_UPLOAD_TYPES as readonly string[]).includes(file.type)) return "Please upload a PDF, PNG or JPG file.";
  if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) return "That file is larger than 3MB. Please upload a smaller copy.";
  return null;
}

/** The coloured "Choose file" button (a <label> wrapping a hidden file input). */
export const DOCUMENT_UPLOAD_BUTTON_CLASS =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-ink-on-dark-primary hover:opacity-90 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2";
