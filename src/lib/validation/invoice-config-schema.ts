import { z } from "zod";

const imageMimeType = z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/**
 * Always partial (PATCH-only, singleton pre-created by seed — no create
 * schema, same pattern as tax-fee-config-schema.ts). Logo/signature are
 * write-only base64 pairs handled specially by the route (saved via
 * saveUploadedFile, the resulting URL written to *Url) — never round-
 * tripped back out through this schema; `removeLogo`/`removeSignature`
 * clear an existing one without replacing it.
 */
export const updateInvoiceConfigSchema = z.object({
  companyGstNumber: z.string().trim().max(20, "GST number is too long").optional().nullable(),
  defaultSacCode: z.string().trim().max(10, "SAC code is too long").optional().nullable(),
  bankAccountName: z.string().trim().max(120, "Too long").optional().nullable(),
  bankAccountNumber: z.string().trim().max(40, "Too long").optional().nullable(),
  bankIfscCode: z.string().trim().max(20, "Too long").optional().nullable(),
  bankName: z.string().trim().max(120, "Too long").optional().nullable(),
  bankBranch: z.string().trim().max(120, "Too long").optional().nullable(),
  termsAndNotes: z.string().trim().max(4000, "Terms and notes is too long").optional(),
  signatoryName: z.string().trim().max(120, "Too long").optional().nullable(),
  signatoryTitle: z.string().trim().max(120, "Too long").optional().nullable(),
  logoImageBase64: z.string().optional(),
  logoImageMimeType: imageMimeType.optional(),
  removeLogo: z.boolean().optional(),
  signatureImageBase64: z.string().optional(),
  signatureImageMimeType: imageMimeType.optional(),
  removeSignature: z.boolean().optional(),
});

export type UpdateInvoiceConfigValues = z.infer<typeof updateInvoiceConfigSchema>;
