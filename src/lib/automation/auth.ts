import crypto from "crypto";
import { isPlaceholder } from "@/lib/env-placeholder";

/**
 * Shared-secret auth for n8n -> app calls (see AUTOMATION_WORKFLOWS.md).
 * Unlike Razorpay/Resend/WhatsApp/Anthropic's keys, AUTOMATION_API_KEY isn't
 * issued by a third party — this app generates it and the same value gets
 * pasted into an n8n HTTP Header Auth credential, so there's no "TODO:
 * client provides" placeholder convention here; an unset/empty key just
 * means every /api/automation/* route rejects every request (safe default
 * — never an open bypass).
 */
export function verifyAutomationKey(request: Request): boolean {
  const expected = process.env.AUTOMATION_API_KEY;
  if (isPlaceholder(expected)) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;

  const expectedBuffer = Buffer.from(expected!, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
