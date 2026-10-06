import { describe, expect, it } from "vitest";
import { groupInvoiceLines, invoiceLinesGovernmentFee, parseInvoiceLines } from "../src/lib/invoices/invoice-lines";
import { amountInWords, integerInWords } from "../src/lib/invoices/amount-in-words";

describe("invoice lines (client corrections 2026-10-05)", () => {
  it("groups passengers by type and splits the government fee from the service fee", () => {
    const lines = groupInvoiceLines([
      { label: "UAE Visa — Adult", price: 5500, governmentFee: 3500 },
      { label: "UAE Visa — Adult", price: 5500, governmentFee: 3500 },
      { label: "UAE Visa — Child", price: 4000, governmentFee: 2500 },
    ]);
    expect(lines).toEqual([
      { description: "UAE Visa — Adult", quantity: 2, governmentFee: 3500, serviceFee: 2000 },
      { description: "UAE Visa — Child", quantity: 1, governmentFee: 2500, serviceFee: 1500 },
    ]);
    expect(invoiceLinesGovernmentFee(lines)).toBe(9500);
  });

  it("never lets the government fee exceed the price", () => {
    expect(groupInvoiceLines([{ label: "X", price: 100, governmentFee: 250 }])[0]).toEqual({ description: "X", quantity: 1, governmentFee: 100, serviceFee: 0 });
  });

  it("rejects malformed stored lines", () => {
    expect(parseInvoiceLines(null)).toBeNull();
    expect(parseInvoiceLines([{ description: "X", quantity: 0, governmentFee: 1, serviceFee: 1 }])).toBeNull();
    expect(parseInvoiceLines([{ description: "X", quantity: 1, governmentFee: 0, serviceFee: 10 }])).toHaveLength(1);
  });
});

describe("amount in words", () => {
  it("uses the Indian numbering system", () => {
    expect(amountInWords(5860)).toBe("Indian Rupees Five Thousand Eight Hundred Sixty Only");
    expect(integerInWords(12_34_56_789)).toBe("Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine");
    expect(amountInWords(100.5)).toBe("Indian Rupees One Hundred and Fifty Paise Only");
  });
});
