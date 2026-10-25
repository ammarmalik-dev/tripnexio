"use client";

import { createContext, useContext, type ReactNode } from "react";
import { canDoServiceAction, type StaffServiceAction, type StaffServiceGrant } from "@/lib/auth/service-actions";
import type { ServiceType } from "@/generated/prisma/enums";

interface StaffPermissionsValue {
  permissions: readonly string[];
  /** Admin handover §1 — per-service action rows; empty = not in use. */
  servicePermissions: readonly StaffServiceGrant[];
  /** Admin handover §17 — the viewer's refund approval limit; null = no limit. */
  refundApprovalLimit: number | null;
}

const StaffPermissionsContext = createContext<StaffPermissionsValue>({ permissions: [], servicePermissions: [], refundApprovalLimit: null });

/**
 * The signed-in staff member's permission names, for client components that show or hide an action
 * (e.g. client doc 2026-10-15, I9 — Admin-only "move back"). UI courtesy only: every API route still
 * checks the permission itself.
 */
export function StaffPermissionsProvider({
  permissions,
  servicePermissions = [],
  refundApprovalLimit = null,
  children,
}: {
  permissions: readonly string[];
  servicePermissions?: readonly StaffServiceGrant[];
  refundApprovalLimit?: number | null;
  children: ReactNode;
}) {
  return <StaffPermissionsContext.Provider value={{ permissions, servicePermissions, refundApprovalLimit }}>{children}</StaffPermissionsContext.Provider>;
}

/** The viewer's refund approval limit (null = none; an Admin is never limited). UI courtesy only. */
export function useRefundApprovalLimit(): number | null {
  const { permissions, refundApprovalLimit } = useContext(StaffPermissionsContext);
  return permissions.includes("admin.full") ? null : refundApprovalLimit;
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
