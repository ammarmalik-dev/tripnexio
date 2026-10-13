import { describe, expect, it } from "vitest";
import { unusedRuleMessage, usesPricingRules } from "../src/lib/pricing/price-sources";

describe("pricing rule sources", () => {
  it("only New Visa and Visa Change read pricing rules", () => {
    expect(usesPricingRules("NEW_VISA")).toBe(true);
    expect(usesPricingRules("VISA_CHANGE")).toBe(true);
    expect(usesPricingRules("RETURN_TICKET")).toBe(false);
    expect(usesPricingRules("OTB")).toBe(false);
    expect(usesPricingRules("VISA_EXTENSION")).toBe(false);
    expect(usesPricingRules("FLIGHT_SPECIAL_FARE")).toBe(false);
  });

  it("points an unused Return Ticket rule to the Return Ticket tab", () => {
    expect(unusedRuleMessage("RETURN_TICKET")).toContain("Pricing Dashboard → Return Ticket");
  });
});
