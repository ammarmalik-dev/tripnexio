import { describe, expect, it } from "vitest";
import { borderTripComplete, parseOperationalBlock, withBorderTrip, type BorderBlock } from "@/lib/visa-change/operational";

// Client doc 2026-10-20 (D8) — a Border Exit option is quoted with just its border; trip details follow after payment.
describe("Visa Change Border Exit trip details (D8)", () => {
  const quoteBlock = { kind: "BORDER", borderId: "b1", borderName: "Sample Border 1", borderCountryName: "Oman" };

  it("accepts an option block that carries only the border", () => {
    expect(parseOperationalBlock(quoteBlock)?.kind).toBe("BORDER");
    expect(parseOperationalBlock({ kind: "BORDER", borderName: "x" })).toBeNull();
  });

  it("is incomplete until the booking's trip details are saved", () => {
    const block = withBorderTrip(parseOperationalBlock(quoteBlock), {}) as BorderBlock;
    expect(borderTripComplete(block)).toBe(false);
  });

  it("merges the trip details saved on the lead into the option's border", () => {
    const details = {
      borderOperationalDetails: { pickupLocation: "Deira", reportingTime: "6:00 AM", travelTime: "7:00 AM", pickupPersonName: "Driver", vehicleNumber: "" },
    };
    const block = withBorderTrip(parseOperationalBlock(quoteBlock), details) as BorderBlock;
    expect(block.borderName).toBe("Sample Border 1");
    expect(block.pickupLocation).toBe("Deira");
    expect(borderTripComplete(block)).toBe(true);
  });
});
