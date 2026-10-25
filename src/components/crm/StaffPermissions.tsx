"use client";

import { createContext, useContext, type ReactNode } from "react";
import { canDoServiceAction, type StaffServiceAction, type StaffServiceGrant } from "@/lib/auth/service-actions";
import type { ServiceType } from "@/generated/prisma/enums";

interface StaffPermissionsValue {
  permissions: readonly string[];
  /** Admin handover §1 — per-service action rows; empty = not in use. */
  servicePermissions: readonly StaffServiceGrant[];
}

const StaffPermissionsContext = createContext<StaffPermissionsValue>({ permissions: [], servicePermissions: [] });

/**
 * The signed-in staff member's permission names, for client components that show or hide an action
 * (e.g. client doc 2026-10-15, I9 — Admin-only "move back"). UI courtesy only: every API route still
 * checks the permission itself.
 */
export function StaffPermissionsProvider({
  permissions,
  servicePermissions = [],
  children,
}: {
  permissions: readonly string[];
  servicePermissions?: readonly StaffServiceGrant[];
  children: ReactNode;
}) {
  return <StaffPermissionsContext.Provider value={{ permissions, servicePermissions }}>{children}</StaffPermissionsContext.Provider>;
}

export function useHasPermission(name: string): boolean {
  const { permissions } = useContext(StaffPermissionsContext);
  return permissions.includes("admin.full") || permissions.includes(name);
}

/**
 * Admin handover §1 — whether the viewer's service-wise permissions allow `action` on `serviceType`
 * (the role permission is checked separately with useHasPermission). UI courtesy only.
 */
export function useCanDoServiceAction(serviceType: ServiceType, action: StaffServiceAction): boolean {
  const { permissions, servicePermissions } = useContext(StaffPermissionsContext);
  return canDoServiceAction({ permissions: [...permissions], servicePermissions: [...servicePermissions] }, serviceType, action);
}
