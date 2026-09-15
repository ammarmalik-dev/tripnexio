import { jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { getIntegrationsHealth } from "@/lib/admin/integrations-health";

/**
 * Step 25 (audit §4.5) — extends the existing Admin Automation page (n8n
 * job monitoring only, until now) into a broader integrations health
 * dashboard per ADMIN.md §11/§36's "Platform" monitoring section,
 * deliberately scoped narrow to provider/connection health — not live
 * visitor tracking, which those sections also ask for but the roadmap
 * prompt explicitly defers.
 *
 * The actual query logic lives in src/lib/admin/integrations-health.ts
 * (extracted there in Step 27 so the Admin AI Command Center's
 * INTEGRATION_HEALTH handler can reuse it identically instead of
 * duplicating it) — see that file's own doc comment for the full design
 * rationale (configured-detection, real success/error signals).
 */
export async function GET() {
  const auth = await requirePermission("automation.view");
  if (auth.error) return auth.error;

  const integrations = await getIntegrationsHealth();
  return jsonSuccess({ integrations });
}
