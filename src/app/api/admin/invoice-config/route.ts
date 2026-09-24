import type { NextRequest } from "next/server";
import { updateInvoiceConfigSchema } from "@/lib/validation/invoice-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/storage/local-file-storage";

const INVOICE_CONFIG_ID = "singleton";

/** Self-healing, same pattern as /api/admin/service-timelines — the row is pre-seeded, but a GET never 404s if it's somehow missing. */
async function getOrCreateConfig() {
  const existing = await db.invoiceConfig.findUnique({ where: { id: INVOICE_CONFIG_ID } });
  if (existing) return existing;
  return db.invoiceConfig.create({ data: { id: INVOICE_CONFIG_ID, termsAndNotes: "" } });
}

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const config = await getOrCreateConfig();
  return jsonSuccess(config);
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateInvoiceConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const { logoImageBase64, logoImageMimeType, removeLogo, signatureImageBase64, signatureImageMimeType, removeSignature, ...fields } = parsed.data;

  const existing = await getOrCreateConfig();

  let companyLogoUrl = existing.companyLogoUrl;
  if (logoImageBase64 && logoImageMimeType) {
    const saved = await saveUploadedFile(logoImageBase64, logoImageMimeType, "invoice-config");
    if (existing.companyLogoUrl) await deleteUploadedFile(existing.companyLogoUrl);
    companyLogoUrl = saved.url;
  } else if (removeLogo && existing.companyLogoUrl) {
    await deleteUploadedFile(existing.companyLogoUrl);
    companyLogoUrl = null;
  }

  let signatureImageUrl = existing.signatureImageUrl;
  if (signatureImageBase64 && signatureImageMimeType) {
    const saved = await saveUploadedFile(signatureImageBase64, signatureImageMimeType, "invoice-config");
    if (existing.signatureImageUrl) await deleteUploadedFile(existing.signatureImageUrl);
    signatureImageUrl = saved.url;
  } else if (removeSignature && existing.signatureImageUrl) {
    await deleteUploadedFile(existing.signatureImageUrl);
    signatureImageUrl = null;
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.invoiceConfig.update({
      where: { id: INVOICE_CONFIG_ID },
      data: { ...fields, companyLogoUrl, signatureImageUrl },
    });
    await writeAudit(tx, {
      entityType: "InvoiceConfig",
      entityId: INVOICE_CONFIG_ID,
      action: "UPDATE",
      byUserId: session.id,
      note: `Invoice configuration updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
