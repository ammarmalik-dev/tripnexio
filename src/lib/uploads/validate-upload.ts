import { jsonError } from "@/lib/api/respond";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;
export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

/** Detects the real file type from its leading bytes — the client-declared MIME type is never trusted. */
export function sniffMimeType(buffer: Buffer): AllowedUploadMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

export type UploadCheck =
  | { ok: true; buffer: Buffer; mimeType: AllowedUploadMimeType }
  | { ok: false; status: 413 | 415; message: string };

/**
 * Server-side size + type check for a base64 upload. Size is measured on the
 * decoded bytes (a quick length estimate first, so a huge string is rejected
 * before being decoded). `allowed` narrows the accepted types for a given
 * field (e.g. images only).
 */
export function checkBase64Upload(
  base64: string,
  allowed: readonly AllowedUploadMimeType[] = ALLOWED_UPLOAD_MIME_TYPES,
  maxBytes: number = MAX_UPLOAD_BYTES
): UploadCheck {
  const approximateBytes = Math.floor((base64.length * 3) / 4);
  if (approximateBytes > maxBytes + 4) {
    return { ok: false, status: 413, message: `That file is too large (${Math.round(maxBytes / (1024 * 1024))}MB max).` };
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > maxBytes) {
    return { ok: false, status: 413, message: `That file is too large (${Math.round(maxBytes / (1024 * 1024))}MB max).` };
  }
  const mimeType = sniffMimeType(buffer);
  if (!mimeType || !allowed.includes(mimeType)) {
    return { ok: false, status: 415, message: "Unsupported file type — use JPEG, PNG, WebP, GIF or PDF." };
  }
  return { ok: true, buffer, mimeType };
}

/** Runs checkBase64Upload on every provided (non-empty) field; returns an error Response for the first failure, or null. */
export function rejectInvalidUploads(fields: (string | null | undefined)[], allowed?: readonly AllowedUploadMimeType[]): Response | null {
  for (const value of fields) {
    if (!value) continue;
    const check = checkBase64Upload(value, allowed);
    if (!check.ok) return jsonError(check.status, check.message);
  }
  return null;
}
