import { describe, expect, it } from "vitest";
import { formatInvoiceNumber, invoiceLetters } from "../src/lib/invoices/invoice-number";
import { invoiceNumberFromSlug, invoiceNumberToSlug } from "../src/lib/invoices/invoice-filters";

describe("invoice numbers (client doc 2026-10-20, J1)", () => {
  it("runs TNS/A2601 … TNS/A2699, then the next letter", () => {
    expect(formatInvoiceNumber("2026-27", 1)).toBe("TNS/A2601");
    expect(formatInvoiceNumber("2026-27", 99)).toBe("TNS/A2699");
    expect(formatInvoiceNumber("2026-27", 100)).toBe("TNS/B2601");
    expect(formatInvoiceNumber("2026-27", 26 * 99)).toBe("TNS/Z2699");
    expect(formatInvoiceNumber("2026-27", 26 * 99 + 1)).toBe("TNS/AA2601");
    expect(formatInvoiceNumber("2026-27", 27 * 99 + 1)).toBe("TNS/AB2601");
  });

  it("changes the year every financial year", () => {
    expect(formatInvoiceNumber("2027-28", 1)).toBe("TNS/A2701");
  });

  it("letter blocks go A … Z, AA, AB …", () => {
    expect(invoiceLetters(0)).toBe("A");
    expect(invoiceLetters(25)).toBe("Z");
    expect(invoiceLetters(26)).toBe("AA");
    expect(invoiceLetters(27)).toBe("AB");
  });

  it("the verify link's path form round-trips", () => {
    expect(invoiceNumberToSlug("TNS/A2601")).toBe("TNS-A2601");
    expect(invoiceNumberFromSlug("TNS-A2601")).toBe("TNS/A2601");
    expect(invoiceNumberFromSlug("TNS-AB2699")).toBe("TNS/AB2699");
  });
});

import { enquirySerial } from "../src/lib/enquiries/labels";

describe("enquiry serials (client doc 2026-10-20, I1)", () => {
  it("runs ENQ-TNA0001 … ENQ-TNA9999, then ENQ-TNB0001 … ENQ-TNZ9999", () => {
    expect(enquirySerial(1)).toBe("ENQ-TNA0001");
    expect(enquirySerial(9999)).toBe("ENQ-TNA9999");
    expect(enquirySerial(10000)).toBe("ENQ-TNB0001");
    expect(enquirySerial(26 * 9999)).toBe("ENQ-TNZ9999");
  });
});
