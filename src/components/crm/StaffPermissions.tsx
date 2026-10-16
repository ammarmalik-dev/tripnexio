"use client";

import { createContext, useContext, type ReactNode } from "react";

const StaffPermissionsContext = createContext<readonly string[]>([]);

/**
 * The signed-in staff member's permission names, for client components that show or hide an action
 * (e.g. client doc 2026-10-15, I9 — Admin-only "move back"). UI courtesy only: every API route still
 * checks the permission itself.
 */
export function StaffPermissionsProvider({ permissions, children }: { permissions: readonly string[]; children: ReactNode }) {
  return <StaffPermissionsContext.Provider value={permissions}>{children}</StaffPermissionsContext.Provider>;
}

export function useHasPermission(name: string): boolean {
  const permissions = useContext(StaffPermissionsContext);
  return permissions.includes("admin.full") || permissions.includes(name);
}
