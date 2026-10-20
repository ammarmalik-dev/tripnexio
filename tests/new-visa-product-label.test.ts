import { describe, expect, it } from "vitest";
import { productLabel } from "@/lib/new-visa/products";

// Client doc 2026-10-20 (E7) — one line: Stay Duration · Entry Type · Visa Category.
describe("New Visa option label (E7)", () => {
  it("reads stay, entry, then category", () => {
    expect(productLabel({ stayDays: 30, duration: "", entryKind: "SINGLE", entryType: "", visaCategory: "Tourist" })).toBe("30 Days · Single Entry · Tourist");
  });
  it("leaves out a blank category", () => {
    expect(productLabel({ stayDays: 60, duration: "", entryKind: "MULTIPLE", entryType: "", visaCategory: " " })).toBe("60 Days · Multiple Entry");
  });
});
