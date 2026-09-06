import { cookies } from "next/headers";
import { db } from "../db";
import { SESSION_COOKIE_NAME, verifyStaffSessionToken } from "./session";

export interface StaffSession {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Every permission name granted by this user's role — see src/lib/auth/permissions.ts. */
  permissions: string[];
}

/**
 * Authoritative staff-session check for Server Components and Route
 * Handlers (Node.js runtime — has DB access, unlike middleware). Re-checks
 * the User is still `active` rather than trusting the JWT claims alone, so
 * a deactivated staff account loses access immediately, not just after the
 * token expires. Permissions are read fresh from the DB on every call too
 * (not cached in the JWT), so a role's permissions changing takes effect
 * immediately rather than waiting for the 8h token to expire.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyStaffSessionToken(token);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    include: { role: { include: { permissions: true } } },
  });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions.map((permission) => permission.name),
  };
}
