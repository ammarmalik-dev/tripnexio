import crypto from "crypto";
import { isPlaceholder } from "@/lib/env-placeholder";

/**
 * Shared-secret auth for scheduler -> app calls (see AUTOMATION_WORKFLOWS.md).
 * Two schedulers are supported, each with its own secret:
 *
 * - n8n (or any VPS cron) sends `Authorization: Bearer <AUTOMATION_API_KEY>`.
 * - Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` on a GET — Vercel
 *   injects that header automatically once CRON_SECRET is set in the
 *   project's environment variables (see vercel.json's "crons").
 *
 * Neither key is issued by a third party — this app's operator generates
 * them — so there's no "TODO: client provides" convention here. An
 * unset/empty/placeholder key is simply ignored; if both are unset, every
 * /api/automation/* route rejects every request (safe-closed — never an open
 * bypass). Both comparisons are constant-time.
 */
function matchesSecret(provided: string, expected: string | undefined): boolean {
  if (isPlaceholder(expected)) return false;
  const expectedBuffer = Buffer.from(expected!, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function verifyAutomationKey(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header) return false;
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;
  if (provided.length === 0) return false;

  // Evaluate both (no short-circuit) so timing doesn't reveal which secret matched.
  const automationMatch = matchesSecret(provided, process.env.AUTOMATION_API_KEY);
  const cronMatch = matchesSecret(provided, process.env.CRON_SECRET);
  return automationMatch || cronMatch;
}
