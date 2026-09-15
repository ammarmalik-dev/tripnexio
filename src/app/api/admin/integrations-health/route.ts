import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { isPlaceholder } from "@/lib/env-placeholder";

interface IntegrationEvent {
  at: string;
  detail: string;
}

interface IntegrationHealth {
  key: string;
  label: string;
  configured: boolean;
  lastSuccess: IntegrationEvent | null;
  lastError: IntegrationEvent | null;
}

/**
 * Step 25 (audit §4.5) — extends the existing Admin Automation page (n8n
 * job monitoring only, until now) into a broader integrations health
 * dashboard per ADMIN.md §11/§36's "Platform" monitoring section,
 * deliberately scoped narrow to provider/connection health — not live
 * visitor tracking, which those sections also ask for but the roadmap
 * prompt explicitly defers.
 *
 * "Configured" reuses the exact same isPlaceholder() env-var check each
 * integration's own get-gateway.ts/get-sender.ts/get-provider.ts factory
 * already uses to pick real-vs-mock — checked directly here rather than by
 * calling those factories, since instantiating a gateway object just to
 * read its config state would be pointless (and the factories cache their
 * decision on first call anyway, so a live read of process.env is more
 * honest for a dashboard than trusting a memoized singleton).
 *
 * "Last success"/"last error" are real signals, not derived/estimated:
 * Email and WhatsApp already wrote EMAIL_SENT/EMAIL_FAILED and
 * WHATSAPP_SENT/WHATSAPP_FAILED audit rows (Phase 5B/5C). Payment Gateway
 * and OCR had no equivalent failure visibility before this step — a
 * createPaymentLink()/provider.extractX() error just threw uncaught, so
 * PAYMENT_GATEWAY_ERROR and OCR_FAILED audit actions were added at those
 * exact call sites (src/app/api/bookings/[id]/payments/route.ts,
 * src/lib/ocr/call-with-failure-audit.ts) as a small, additive change —
 * same failure-visibility guarantee the other two integrations already
 * had, not a new behavior. "Last success" for those two uses the closest
 * existing real signal instead (a Payment row that actually got a
 * gatewayRef back from the gateway; any DocumentExtraction row at all,
 * since one only ever gets created after the provider call succeeds).
 */
export async function GET() {
  const auth = await requirePermission("automation.view");
  if (auth.error) return auth.error;

  const paymentGatewayConfigured =
    !isPlaceholder(process.env.RAZORPAY_KEY_ID) &&
    !isPlaceholder(process.env.RAZORPAY_KEY_SECRET) &&
    !isPlaceholder(process.env.RAZORPAY_WEBHOOK_SECRET);
  const emailConfigured = !isPlaceholder(process.env.RESEND_API_KEY);
  const whatsappConfigured =
    !isPlaceholder(process.env.WHATSAPP_ACCESS_TOKEN) &&
    !isPlaceholder(process.env.WHATSAPP_PHONE_NUMBER_ID) &&
    !isPlaceholder(process.env.WHATSAPP_APP_SECRET);
  const ocrConfigured = !isPlaceholder(process.env.ANTHROPIC_API_KEY);

  const [lastSuccessfulPayment, lastGatewayError, lastEmailSent, lastEmailFailed, lastWhatsappSent, lastWhatsappFailed, lastExtraction, lastOcrError] =
    await Promise.all([
      db.payment.findFirst({ where: { gatewayRef: { not: null } }, orderBy: { createdAt: "desc" }, select: { createdAt: true, gatewayRef: true } }),
      db.auditTrail.findFirst({ where: { action: "PAYMENT_GATEWAY_ERROR" }, orderBy: { timestamp: "desc" } }),
      db.auditTrail.findFirst({ where: { action: "EMAIL_SENT" }, orderBy: { timestamp: "desc" } }),
      db.auditTrail.findFirst({ where: { action: "EMAIL_FAILED" }, orderBy: { timestamp: "desc" } }),
      db.auditTrail.findFirst({ where: { action: "WHATSAPP_SENT" }, orderBy: { timestamp: "desc" } }),
      db.auditTrail.findFirst({ where: { action: "WHATSAPP_FAILED" }, orderBy: { timestamp: "desc" } }),
      db.documentExtraction.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, provider: true, extractionType: true } }),
      db.auditTrail.findFirst({ where: { action: "OCR_FAILED" }, orderBy: { timestamp: "desc" } }),
    ]);

  const integrations: IntegrationHealth[] = [
    {
      key: "payment-gateway",
      label: "Payment Gateway (Razorpay)",
      configured: paymentGatewayConfigured,
      lastSuccess: lastSuccessfulPayment
        ? { at: lastSuccessfulPayment.createdAt.toISOString(), detail: `Payment link created (ref: ${lastSuccessfulPayment.gatewayRef})` }
        : null,
      lastError: lastGatewayError ? { at: lastGatewayError.timestamp.toISOString(), detail: lastGatewayError.note ?? "Gateway error" } : null,
    },
    {
      key: "email",
      label: "Email (Resend)",
      configured: emailConfigured,
      lastSuccess: lastEmailSent ? { at: lastEmailSent.timestamp.toISOString(), detail: lastEmailSent.note ?? "Email sent" } : null,
      lastError: lastEmailFailed ? { at: lastEmailFailed.timestamp.toISOString(), detail: lastEmailFailed.note ?? "Email failed" } : null,
    },
    {
      key: "whatsapp",
      label: "WhatsApp Cloud API",
      configured: whatsappConfigured,
      lastSuccess: lastWhatsappSent ? { at: lastWhatsappSent.timestamp.toISOString(), detail: lastWhatsappSent.note ?? "Message sent" } : null,
      lastError: lastWhatsappFailed ? { at: lastWhatsappFailed.timestamp.toISOString(), detail: lastWhatsappFailed.note ?? "Message failed" } : null,
    },
    {
      key: "ocr",
      label: "OCR (Anthropic)",
      configured: ocrConfigured,
      lastSuccess: lastExtraction
        ? { at: lastExtraction.createdAt.toISOString(), detail: `${lastExtraction.extractionType} extraction via ${lastExtraction.provider}` }
        : null,
      lastError: lastOcrError ? { at: lastOcrError.timestamp.toISOString(), detail: lastOcrError.note ?? "OCR failed" } : null,
    },
  ];

  return jsonSuccess({ integrations });
}
