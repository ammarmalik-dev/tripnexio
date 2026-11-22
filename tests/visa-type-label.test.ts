import { describe, expect, it } from "vitest";
import { newVisaTypeLabel, serviceDetailsLine } from "../src/lib/crm/service-details";
import { productLabel } from "../src/lib/new-visa/products";

const product = { stayDays: 30, duration: "30_DAYS", entryKind: "SINGLE", entryType: "SINGLE", visaCategory: "Tourist", validityType: { name: "58 Days" } };

describe("Client doc 16 Nov F7/F8 — New Visa type and validity", () => {
  it("hides the validity unless the country shows it", () => {
    expect(productLabel(product)).not.toContain("58 Days");
    expect(productLabel({ ...product, country: { showVisaValidity: false } })).not.toContain("58 Days");
    expect(productLabel({ ...product, country: { showVisaValidity: true } })).toContain("Validity 58 Days");
  });

  it("shows the visa type instead of New Visa, and keeps it out of the details line", () => {
    const details = { newVisaConfigId: "x", visaOption: "30 Days · Single Entry", visaCategory: "Tourist" };
    expect(newVisaTypeLabel("NEW_VISA", details)).toBe("Tourist");
    expect(newVisaTypeLabel("NEW_VISA", {})).toBe("Any");
    expect(newVisaTypeLabel("NEW_VISA", { visaType: "transit" })).toBe("Transit");
    expect(newVisaTypeLabel("OTB", details)).toBeNull();
    expect(serviceDetailsLine("NEW_VISA", details)).toBe("30 Days · Single Entry");
  });
});
