import { describe, expect, it } from "vitest";
import { formatDetailValue } from "../src/lib/crm/humanize";

describe("formatDetailValue", () => {
  it("reads a nested object as text, not [object Object]", () => {
    const out = formatDetailValue("FLIGHT_SPECIAL_FARE", "draftContact", { fullName: "A Khan", mobile: "9876543210", email: "" });
    expect(out).toBe("Full Name: A Khan · Mobile: 9876543210");
  });

  it("formats ISO timestamps and lists", () => {
    expect(formatDetailValue("OTB", "draftCapturedAt", "2026-10-27T19:05:29.486Z")).not.toContain("T19:05");
    expect(formatDetailValue("OTB", "airlines", ["IndiGo", "Emirates"])).toBe("IndiGo, Emirates");
  });

  it("keeps plain values", () => {
    expect(formatDetailValue("OTB", "abandonedDraft", true)).toBe("Yes");
    expect(formatDetailValue("OTB", "travelDate", "2026-11-01")).toBe("2026-11-01");
    expect(formatDetailValue("OTB", "pax", 2)).toBe("2");
  });
});
