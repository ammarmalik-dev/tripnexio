import { getStaffSession, type StaffSession } from "./staff-session";
import { hasPermission } from "./permissions";
import { jsonError } from "@/lib/api/respond";

type RequirePermissionResult = { session: StaffSession; error?: undefined } | { session?: undefined; error: Response };

/**
 * Combined auth + permission check for API routes — 401 if not signed in,
 * 403 if signed in but the role lacks the permission (or `admin.full`).
 * Enforced server-side per CLAUDE.md's own security standard; the CRM/Admin
 * UI hiding a button is a courtesy, never the actual gate.
 *
 * Usage: `const auth = await requirePermission("leads.view"); if (auth.error) return auth.error;`
 */
export async function requirePermission(permission: string): Promise<RequirePermissionResult> {
  const session = await getStaffSession();
  if (!session) return { error: jsonError(401, "Sign in required.") };
  if (!hasPermission(session, permission)) {
    return { error: jsonError(403, "You don't have permission to do this.") };
  }
  return { session };
}
