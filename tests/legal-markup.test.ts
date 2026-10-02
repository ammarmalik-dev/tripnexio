import { describe, expect, it } from "vitest";
import { parseInline, parseLegalMarkup } from "../src/lib/legal/markup";
import { DEFAULT_LEGAL_PAGES } from "../src/lib/legal/default-pages";
import { LEGAL_PAGE_META, LEGAL_PAGE_SLUGS } from "../src/lib/legal/pages";

describe("parseLegalMarkup", () => {
  it("collapses extra blank lines and spaces", () => {
    const blocks = parseLegalMarkup("\n\n## 1.   About\n\n\n\nFirst   line\ncontinues here.   \n\n\n\nSecond paragraph.\n\n");
    expect(blocks).toEqual([
      { type: "heading", text: "1. About" },
      { type: "paragraph", text: "First line continues here." },
      { type: "paragraph", text: "Second paragraph." },
    ]);
  });

  it("reads bullet lists and tokens", () => {
    const blocks = parseLegalMarkup("Intro\n- one\n-   two\n• three\n\n{{grievanceOfficer}}");
    expect(blocks).toEqual([
      { type: "paragraph", text: "Intro" },
      { type: "list", items: ["one", "two", "three"] },
      { type: "token", name: "grievanceOfficer" },
    ]);
  });

  it("handles Windows line endings", () => {
    expect(parseLegalMarkup("## A\r\n\r\nText")).toEqual([
      { type: "heading", text: "A" },
      { type: "paragraph", text: "Text" },
    ]);
  });
});

describe("parseInline", () => {
  it("renders bold and safe links", () => {
    expect(parseInline("See **our policy** at [Refunds](/legal/refund-policy).")).toEqual([
      { type: "text", text: "See " },
      { type: "bold", text: "our policy" },
      { type: "text", text: " at " },
      { type: "link", text: "Refunds", href: "/legal/refund-policy" },
      { type: "text", text: "." },
    ]);
  });

  it("never turns javascript: or protocol-relative URLs into links", () => {
    expect(parseInline("[x](javascript:alert(1))").some((part) => part.type === "link")).toBe(false);
    expect(parseInline("[x](//evil.example)").some((part) => part.type === "link")).toBe(false);
  });
});

describe("default legal copy", () => {
  it("has every page, with each page's automatic parts present", () => {
    for (const slug of LEGAL_PAGE_SLUGS) {
      const page = DEFAULT_LEGAL_PAGES[slug];
      expect(page.title.length).toBeGreaterThan(3);
      const tokens = parseLegalMarkup(page.body).flatMap((block) => (block.type === "token" ? [`{{${block.name}}}`] : []));
      expect(tokens.sort()).toEqual(LEGAL_PAGE_META[slug].tokens.map((entry) => entry.token).sort());
    }
  });

  it("keeps the locked Terms copy (17 sections)", () => {
    const headings = parseLegalMarkup(DEFAULT_LEGAL_PAGES.terms.body).filter((block) => block.type === "heading");
    expect(headings).toHaveLength(17);
  });
});
