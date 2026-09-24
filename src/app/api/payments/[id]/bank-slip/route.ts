import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { saveUploadedFile } from "@/lib/storage/local-file-storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  fileBase64: z.string().min(1, "Choose a file to upload"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"], { error: "Unsupported file type" }),
});

/**
 * Step 51 — staff uploads the customer's bank-transfer slip as evidence,
 * a separate step from the approval itself (payments.approve) so the
 * "required approval process" the client asked for is a real raise-vs-
 * approve split, not just one click. Re-uploading replaces the previous
 * slip (same "always create fresh, not update in place" reasoning doesn't
 * apply here — there's exactly one slip per payment, so this simply
 * overwrites the field).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  const payment = await db.payment.findUnique({ where: { id }, include: { booking: { include: { lead: true } } } });
  if (!payment) return jsonError(404, "Payment not found.");
  const scopeError = assertServiceAccess(session, payment.booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (payment.method !== "BANK_TRANSFER") {
    return jsonError(409, "This payment isn't a bank transfer.");
  }
  if (payment.status !== "PENDING") {
    return jsonError(409, `This payment is already ${payment.status.toLowerCase()}.`);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const { url } = await saveUploadedFile(parsed.data.fileBase64, parsed.data.mimeType, "bank-slips");

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.payment.update({ where: { id }, data: { bankSlipUrl: url } });
      await writeAudit(tx, {
        entityType: "Payment",
        entityId: id,
        action: "BANK_SLIP_UPLOADED",
        byUserId: session.id,
        note: `Bank-transfer slip uploaded (by ${session.name})`,
      });
      return result;
    });

    return jsonSuccess(updated);
  } catch (error) {
    console.error("[payments/bank-slip]", error);
    return jsonError(500, "Couldn't process that file. Please try again.");
  }
}
