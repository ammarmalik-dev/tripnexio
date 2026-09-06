import { db } from "../db";
import { ADMIN_FULL_PERMISSION } from "./permissions";

/**
 * True if at least one active user OTHER than `excludeUserId` holds a role
 * granting admin.full. Used before deactivating a staff account or moving
 * it off an admin.full role, so the client's "top-level admin role with
 * full access" can never be locked out entirely.
 */
export async function hasAnotherActiveAdmin(excludeUserId: string): Promise<boolean> {
  const count = await db.user.count({
    where: {
      id: { not: excludeUserId },
      active: true,
      role: { permissions: { some: { name: ADMIN_FULL_PERMISSION } } },
    },
  });
  return count > 0;
}
