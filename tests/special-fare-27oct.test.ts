import { describe, expect, it } from "vitest";
import { paxCountsLine, previewPaxTypeLabel } from "../src/lib/special-fare/pax-summary";
import { draftSendValidity } from "../src/lib/quotations/send-validity";
import { firstFormErrorMessage } from "../src/lib/forms-first-error";
import { perPaxTotal } from "../src/lib/special-fare/pax-counts";

describe("Special Fare — client doc 2026-10-27", () => {
  it("A2: passenger type comes from DOB on the travel date (Adult 12+, Child 2-11, Infant under 2)", () => {
    expect(previewPaxTypeLabel("1990-05-01", "2026-10-29")).toBe("Adult");
    expect(previewPaxTypeLabel("2014-10-29", "2026-10-29")).toBe("Adult");
    expect(previewPaxTypeLabel("2014-10-30", "2026-10-29")).toBe("Child");
    expect(previewPaxTypeLabel("2025-06-01", "2026-10-29")).toBe("Infant");
    expect(previewPaxTypeLabel("", "2026-10-29")).toBeNull();
    expect(previewPaxTypeLabel("2025-06-01", undefined)).toBeNull();
  });

  it("A2: the summary's counts line skips types nobody is", () => {
    expect(paxCountsLine(["Adult", "Infant"])).toBe("1 Adult · 1 Infant");
    expect(paxCountsLine(["Adult", "Adult", "Child", "Child", null])).toBe("2 Adults · 2 Children");
    expect(paxCountsLine([])).toBe("");
  });

  it("A6: totals are rate × count per type, a type with no travellers adds nothing", () => {
    expect(perPaxTotal({ adult: 5000, child: 4000, infant: 1000 }, { adult: 1, child: 0, infant: 1 })).toBe(6000);
    expect(perPaxTotal({ adult: 5000 }, { adult: 2, child: 0, infant: 0 })).toBe(10000);
    expect(perPaxTotal({ child: 3000, infant: 500 }, { adult: 0, child: 2, infant: 1 })).toBe(6500);
    expect(perPaxTotal({}, { adult: 1, child: 0, infant: 0 })).toBeNull();
  });

  it("A6: a draft whose validity passed goes out with a fresh window instead of being refused", () => {
    const now = new Date("2026-10-27T10:00:00Z");
    const past = new Date("2026-10-27T09:00:00Z");
    const future = new Date("2026-10-27T10:20:00Z");
    const fresh = new Date("2026-10-27T10:30:00Z");
    expect(draftSendValidity({ explicit: null, stored: past, fallback: fresh, now })).toEqual(fresh);
    expect(draftSendValidity({ explicit: null, stored: future, fallback: fresh, now })).toEqual(future);
    expect(draftSendValidity({ explicit: null, stored: null, fallback: fresh, now })).toEqual(fresh);
    expect(draftSendValidity({ explicit: future, stored: past, fallback: fresh, now })).toEqual(future);
    // A service with no window (non-flight) keeps the stored value — the route still refuses a passed one.
    expect(draftSendValidity({ explicit: null, stored: past, fallback: null, now })).toEqual(past);
  });

  it("A6: an invalid quote form names its first problem (never a silent no-op)", () => {
    expect(firstFormErrorMessage({ itinerary: [undefined, { to: { message: "Arrival must be a different airport.", type: "custom" } }] })).toBe(
      "Arrival must be a different airport."
    );
    expect(firstFormErrorMessage({ vendorCost: { message: "Enter the vendor cost", ref: { name: "x" } } })).toBe("Enter the vendor cost");
    expect(firstFormErrorMessage({})).toBeNull();
  });
});
