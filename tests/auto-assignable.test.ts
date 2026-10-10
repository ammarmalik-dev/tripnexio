import { describe, expect, it } from "vitest";
import { isAutoAssignable } from "../src/lib/staff/eligible-for-assignment";
import { subServiceLabel } from "../src/lib/leads/sub-service-label";

const member = (permissions: string[]) => ({
  id: "u1",
  active: true,
  allowedServiceTypes: [],
  role: { permissions: permissions.map((name) => ({ name })) },
});

describe("automatic assignment (client corrections 2026-10-05)", () => {
  it("never auto-assigns to a Super Admin (admin.full)", () => {
    expect(isAutoAssignable(member(["admin.full"]))).toBe(false);
  });

  it("auto-assigns to active staff who can work leads", () => {
    expect(isAutoAssignable(member(["leads.view", "leads.edit"]))).toBe(true);
  });

  it("skips staff who can't work leads", () => {
    expect(isAutoAssignable(member(["leads.view"]))).toBe(false);
  });
});

describe("sub-service label", () => {
  it("names the Visa Change method", () => {
    expect(subServiceLabel({ changeType: "BORDER_EXIT" })).toBe("Border Exit & Re-entry");
  });
  it("is null when the service has no sub-service", () => {
    expect(subServiceLabel({ travelDate: "2026-10-10" })).toBeNull();
  });
});
