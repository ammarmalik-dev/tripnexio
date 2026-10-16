import { describe, expect, it } from "vitest";
import { SITE_PAGE_DEFS, SITE_PAGES, parseStepLines } from "../src/lib/site-content/pages";

describe("website pages (client doc 2026-10-15, J3)", () => {
  it("reads How It Works steps written as Title | description", () => {
    expect(parseStepLines("Apply | Fill the form\n\nPay | Secure link | any card")).toEqual([
      { headline: "Apply", supportingCopy: "Fill the form" },
      { headline: "Pay", supportingCopy: "Secure link | any card" },
    ]);
    expect(parseStepLines("  \n ")).toBeNull();
  });
  it("gives every service page four default steps and a title", () => {
    for (const page of SITE_PAGES) {
      const fields = SITE_PAGE_DEFS[page].fields;
      expect(fields.find((field) => field.key === "heroTitle")?.fallback).toBeTruthy();
      if (page !== "home") expect(parseStepLines(fields.find((field) => field.key === "steps")?.fallback ?? "")).toHaveLength(4);
    }
  });
});
