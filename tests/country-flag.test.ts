import { describe, expect, it } from "vitest";
import { countryFlag, flagImageSrc } from "../src/lib/countries/flag";

describe("country flags as images", () => {
  it("draws an ISO code as the self-hosted SVG", () => {
    expect(countryFlag({ code: "AE" })).toEqual({ kind: "image", value: "/flags/ae.svg" });
    expect(countryFlag({ code: "UAE" })).toEqual({ kind: "image", value: "/flags/ae.svg" });
  });

  it("keeps an Admin image override and maps an emoji override to its SVG", () => {
    expect(countryFlag({ code: "AE", flagOverride: "https://example.com/f.png" })).toEqual({ kind: "image", value: "https://example.com/f.png" });
    expect(countryFlag({ code: "XX", flagOverride: "🇮🇳" })).toEqual({ kind: "image", value: "/flags/in.svg" });
  });

  it("falls back to the globe for an unknown code", () => {
    expect(countryFlag({ code: "ZZZ" }).kind).toBe("emoji");
  });

  it("turns a flag emoji into its SVG path and leaves other text alone", () => {
    expect(flagImageSrc("🇹🇭")).toBe("/flags/th.svg");
    expect(flagImageSrc("🌐")).toBeNull();
  });
});
