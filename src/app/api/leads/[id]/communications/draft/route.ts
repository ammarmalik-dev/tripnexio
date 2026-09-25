import type { NextRequest } from "next/server";
import { draftCommunicationSchema } from "@/lib/validation/draft-communication-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { buildLeadRecordContext } from "@/lib/drafting/build-lead-context";
import { getDraftProvider } from "@/lib/drafting/get-draft-provider";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Step 56, CRM.md §25 — AI-assisted drafting for the Communications
 * module. Deliberately writes nothing to AuditTrail: a draft is never a
 * "communication sent" event (that's still only PATCH .../send) — CRM.md's
 * own rule is "never auto-send without staff action," so nothing here is
 * visible in the activity timeline until staff actually click Send.
 * Gated by `leads.edit`, same as the send action — not the Admin-only
 * `ai.assist` permission, which scopes a different feature entirely (the
 * Admin AI Command Center).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = draftCommunicationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const lead = await db.lead.findUnique({ where: { id }, include: { customer: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;

  if (parsed.data.channel === "EMAIL" && !lead.customer.email) {
    return jsonError(400, "This customer has no email on file.");
  }

  const recordContext = await buildLeadRecordContext(id);
  if (!recordContext) return jsonError(404, "Lead not found.");

  const provider = getDraftProvider();
  try {
    const result = await provider.draft({
      draftType: parsed.data.draftType,
      channel: parsed.data.channel,
      instructions: parsed.data.instructions,
      existingBody: parsed.data.existingBody,
      recordContext,
    });
    return jsonSuccess({ subject: result.subject, body: result.body, provider: provider.providerName });
  } catch (error) {
    console.error("[communications/draft]", error);
    return jsonError(502, "Couldn't generate a draft right now. Please try again or write the message yourself.");
  }
}
