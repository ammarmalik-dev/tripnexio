import { db } from "@/lib/db";
import { isPlaceholder } from "@/lib/env-placeholder";

export interface IntegrationEvent {
  at: string;
  detail: string;
}

export interface IntegrationHealth {
  key: string;
  label: string;
  configured: boolean;
  lastSuccess: IntegrationEvent | null;
  lastError: IntegrationEvent | null;
}

/**
 * Step 25 (audit §4.5) — "Configured" reuses the exact same isPlaceholder()
 * env-var check each integration's own get-gateway.ts/get-sender.ts/
 * get-provider.ts factory already uses to pick real-vs-mock. "Last
 * success"/"last error" are real signals: Email/WhatsApp's EMAIL_SENT/
 * EMAIL_FAILED and WHATSAPP_SENT/WHATSAPP_FAILED audit rows (Phase 5B/5C),
 * and Payment Gateway/OCR's PAYMENT_GATEWAY_ERROR/OCR_FAILED audit rows
 * added in Step 25 at their exact call sites. Extracted out of its own API
 * route in Step 27 so the Admin AI Command Center's INTEGRATION_HEALTH
 * handler can call the identical logic instead of duplicating it.
 */
export async function getIntegrationsHealth(): Promise<IntegrationHealth[]> {
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

  return [
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
}
