import { describe, expect, it } from "vitest";
import {
  assertServiceAction,
  canDoServiceAction,
  exportScopedSession,
  servicesWithAction,
  type ServiceActionCheckable,
} from "../src/lib/auth/service-actions";
import { effectiveServiceScope, hasServiceAccess, serviceTypeCondition } from "../src/lib/auth/service-scope";

const staff = (servicePermissions: ServiceActionCheckable["servicePermissions"], permissions: string[] = ["leads.view"]) => ({
  permissions,
  servicePermissions,
});

describe("canDoServiceAction", () => {
  it("allows everything when the user has no rows", () => {
    expect(canDoServiceAction(staff(null), "OTB", "REFUND_REQUEST")).toBe(true);
    expect(canDoServiceAction(staff([]), "NEW_VISA", "EDIT")).toBe(true);
  });

  it("denies a service without a row once rows exist", () => {
    const session = staff([{ serviceType: "NEW_VISA", actions: ["VIEW", "EDIT"] }]);
    expect(canDoServiceAction(session, "OTB", "VIEW")).toBe(false);
    expect(assertServiceAction(session, "OTB", "VIEW")?.status).toBe(403);
  });

  it("denies an action missing from the service's row", () => {
    const session = staff([{ serviceType: "NEW_VISA", actions: ["VIEW", "EDIT"] }]);
    expect(canDoServiceAction(session, "NEW_VISA", "EDIT")).toBe(true);
    expect(canDoServiceAction(session, "NEW_VISA", "PAYMENT")).toBe(false);
    expect(assertServiceAction(session, "NEW_VISA", "EDIT")).toBeNull();
  });

  it("always allows admin.full", () => {
    const session = staff([{ serviceType: "NEW_VISA", actions: [] }], ["admin.full"]);
    expect(canDoServiceAction(session, "OTB", "REFUND_REQUEST")).toBe(true);
    expect(servicesWithAction(session, "EXPORT")).toBeNull();
  });

  it("denies a signed-out caller", () => {
    expect(canDoServiceAction(null, "OTB", "VIEW")).toBe(false);
  });
});

describe("service scope with per-service rows", () => {
  it("keeps the old behaviour without rows", () => {
    expect(effectiveServiceScope({ permissions: [], allowedServiceTypes: [] })).toBeNull();
    expect(effectiveServiceScope({ permissions: [], allowedServiceTypes: ["OTB"] })).toEqual(["OTB"]);
  });

  it("limits the scope to services whose row has VIEW", () => {
    const session = {
      permissions: [],
      allowedServiceTypes: [],
      servicePermissions: [
        { serviceType: "NEW_VISA" as const, actions: ["VIEW"] },
        { serviceType: "OTB" as const, actions: ["EDIT"] },
      ],
    };
    expect(effectiveServiceScope(session)).toEqual(["NEW_VISA"]);
    expect(hasServiceAccess(session, "OTB")).toBe(false);
    expect(serviceTypeCondition(session)).toEqual({ serviceType: { in: ["NEW_VISA"] } });
  });

  it("returns an empty (not unrestricted) scope when no row has VIEW", () => {
    const session = { permissions: [], allowedServiceTypes: [], servicePermissions: [{ serviceType: "OTB" as const, actions: ["EDIT"] }] };
    expect(effectiveServiceScope(session)).toEqual([]);
    expect(serviceTypeCondition(session)).toEqual({ serviceType: { in: [] } });
  });

  it("intersects with allowedServiceTypes", () => {
    const session = {
      permissions: [],
      allowedServiceTypes: ["OTB" as const],
      servicePermissions: [
        { serviceType: "NEW_VISA" as const, actions: ["VIEW"] },
        { serviceType: "OTB" as const, actions: ["VIEW"] },
      ],
    };
    expect(effectiveServiceScope(session)).toEqual(["OTB"]);
  });

  it("exports only services carrying EXPORT", () => {
    const session = {
      permissions: [],
      allowedServiceTypes: [],
      servicePermissions: [
        { serviceType: "NEW_VISA" as const, actions: ["VIEW", "EXPORT"] },
        { serviceType: "OTB" as const, actions: ["VIEW"] },
      ],
    };
    expect(effectiveServiceScope(exportScopedSession(session))).toEqual(["NEW_VISA"]);
    const plain = { permissions: [], allowedServiceTypes: [] };
    expect(exportScopedSession(plain)).toBe(plain);
  });
});
