import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/permissions";
import { getIntegrationsHealth } from "@/lib/admin/integrations-health";
import { getGoLiveChecks, getGoLiveState } from "@/lib/admin/go-live-checks";

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

  try {
    // P26 — sequential on purpose (see runSequentially): activity signals, then go-live checks, then the flag.
    const integrations = await getIntegrationsHealth();
    const checks = await getGoLiveChecks();
    const goLive = await getGoLiveState();
    return jsonSuccess({
      integrations,
      checks,
      goLive,
      allChecksPassing: checks.every((check) => check.ok),
      canMarkGoLive: hasPermission(auth.session, "masters.manage"),
    });
  } catch (error) {
    console.error("[admin/integrations-health] GET failed", error);
    return jsonError(500, "Couldn't load integration health.");
  }
}
