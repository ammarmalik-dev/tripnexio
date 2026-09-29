import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { loadCheckoutByToken } from "@/lib/checkout/load-checkout";
import { applyBookingDocumentEvent } from "@/lib/service-status/document-events";
import { dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const reuseSchema = z.object({
  passengerId: z.string().min(1),
  type: z.string().min(1),
  sourceDocumentId: z.string().min(1),
});

/**
 * P10 — the customer clicked "Use existing" on /pay/<token>: attach their
 * earlier upload (same passenger, last 3 months — see findReusableDocuments)
 * to this booking's slot. Only a document the page itself offered can be
 * reused; the file is shared, never copied or changed.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const limited = await rateLimitByIp(request, "pay-document-reuse", { limit: 30, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  const { token } = await params;
  const checkout = await loadCheckoutByToken(token);
  if (!checkout) return jsonError(404, "We couldn't find that payment page.");
  if (checkout.view.payment?.status !== "SUCCESS") {
    return jsonError(409, "Please complete your payment before uploading documents.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = reuseSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please try again.");
  const { passengerId, type, sourceDocumentId } = parsed.data;

  const offer = checkout.view.reusable.find(
    (item) => item.passengerId === passengerId && item.type === type && item.sourceDocumentId === sourceDocumentId
  );
  if (!offer) return jsonError(409, "That document can't be reused here — please upload a new one.");
  const source = await db.document.findUnique({ where: { id: sourceDocumentId }, select: { fileUrl: true, type: true } });
  if (!source?.fileUrl) return jsonError(409, "That document is no longer available — please upload a new one.");

  const bookingId = checkout.booking.id;
  let statusNotifications: StatusNotification[] = [];
  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({ data: { bookingId, passengerId, type, status: "RECEIVED", fileUrl: source.fileUrl } });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: created.id,
      action: "REUSE_CONFIRMED",
      note: `Customer chose "Use existing" — reused their earlier ${source.type} upload (document ${sourceDocumentId}) on the payment page`,
    });
    statusNotifications = await applyBookingDocumentEvent(tx, bookingId, { actorLabel: "customer reuse (website)" });
    return created;
  });
  await dispatchStatusNotifications(statusNotifications);

  return jsonSuccess({ id: document.id, passengerId, type, status: document.status }, 201);
}
