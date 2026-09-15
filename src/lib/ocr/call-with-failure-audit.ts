import { db } from "../db";
import { writeAudit } from "../audit/log";

/**
 * Step 25 (audit §4.5) — the OCR integration had no failure visibility
 * anywhere (unlike email/WhatsApp's EMAIL_FAILED/WHATSAPP_FAILED audit
 * rows) — a provider.extractX() error just threw uncaught out of
 * extract-passport.ts/extract-ticket.ts/extract-visa.ts, no signal for the
 * Admin integrations dashboard to show as "last error." Shared by all three
 * since they're otherwise near-identical call sites. Doesn't change the
 * existing throw behavior a caller-side failure already had — purely an
 * additive logging side effect before rethrowing.
 */
export async function callOcrProviderWithFailureAudit<T>(documentId: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    await writeAudit(db, {
      entityType: "Document",
      entityId: documentId,
      action: "OCR_FAILED",
      note: `OCR extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    throw error;
  }
}
