import { z } from "zod";

/** Keeps the JSON body under typical serverless request limits (~4.5MB) — same cap as the H7 pay-token upload. */
const MAX_BASE64_LENGTH = 4_000_000;

/**
 * Step 55 — the customer's own `/account` upload. Base64 file bytes only,
 * never a `fileUrl` — that "paste an already-hosted URL" shape is a
 * staff-only convenience (`PATCH /api/documents/[id]/upload`); letting a
 * customer submit an arbitrary URL as their "uploaded" document would let
 * them attach content this app never actually received.
 */
export const accountDocumentUploadSchema = z.object({
  fileBase64: z.string().min(1, "Choose a file").max(MAX_BASE64_LENGTH, "That file is too large (3MB max)"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]),
});
