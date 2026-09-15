import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { getCommandProvider } from "@/lib/admin-ai/get-command-provider";
import { executeCommand } from "@/lib/admin-ai/handlers";
import { COMMAND_TYPES } from "@/lib/admin-ai/command-types";

const bodySchema = z.object({ question: z.string().trim().min(1, "Enter a question").max(500, "Question is too long") });

/**
 * Step 27 (audit §4.4) — the Admin AI Command Center. Implements
 * ADMIN.md §10's locked execution model — Understand → Permission Check
 * → Validate → Determine Risk → Confirm if needed → Execute → Audit —
 * for a deliberately narrow READ-ONLY slice (per the roadmap prompt's own
 * scoping): no mutating actions ("create a FAQ," "disable this service")
 * are wired up yet, and the classifier is instructed to recognize those
 * and say so rather than attempt or fake them (see command-types.ts's
 * NOT_AVAILABLE type).
 *
 * - Understand: getCommandProvider().classifyCommand() — the same
 *   swappable Claude-provider pattern the WhatsApp bot's AI layer uses
 *   (src/lib/whatsapp-bot/ai-provider.ts), reused for language
 *   understanding only. This is a genuinely distinct execution layer,
 *   NOT the WhatsApp bot's customer-facing flow engine — different risk
 *   profile (an Admin querying internal data vs. a customer building a
 *   service request), different permission model, different command
 *   catalog.
 * - Permission Check: requirePermission("ai.assist") below — every
 *   command type in this step shares one Admin-only gate (see ai.assist's
 *   own doc comment in permissions.ts for why per-domain sub-gating isn't
 *   layered on top here).
 * - Validate / Determine Risk / Confirm: every implemented command type
 *   declares riskLevel "read" (command-types.ts) — no mutation is
 *   possible, so no confirmation step exists yet. This is the hook point
 *   for a future mutating command type: it would declare a higher
 *   riskLevel, and this route would need to return a pending-confirmation
 *   response instead of executing immediately. "Validate" per command
 *   type (does the extracted param actually resolve to something real)
 *   happens inside each handler in src/lib/admin-ai/handlers.ts, which
 *   returns a `validationError` instead of throwing when it can't.
 * - Execute: executeCommand() dispatches to one hand-written, bounded
 *   handler function — the AI never generates or runs its own queries.
 * - Audit: every query, regardless of outcome, writes an AuditTrail row.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("ai.assist");
  if (auth.error) return auth.error;
  const { session } = auth;

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

  const provider = getCommandProvider();
  const classification = await provider.classifyCommand(parsed.data.question);
  const result = await executeCommand(classification.commandType, classification.param);

  await writeAudit(db, {
    entityType: "AdminAiCommand",
    entityId: crypto.randomUUID(),
    action: "QUERY",
    byUserId: session.id,
    note: `"${parsed.data.question}" -> ${classification.commandType}${classification.param ? ` (param: ${classification.param})` : ""} via ${provider.providerName}`,
  });

  return jsonSuccess({
    question: parsed.data.question,
    commandType: classification.commandType,
    riskLevel: COMMAND_TYPES[classification.commandType].riskLevel,
    requiresConfirmation: false,
    summary: result.validationError ?? result.summary,
    facts: result.facts,
    validationError: result.validationError ?? null,
  });
}
