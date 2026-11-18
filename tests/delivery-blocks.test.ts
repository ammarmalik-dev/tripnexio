import { describe, expect, it } from "vitest";
import { DELIVERY_EVENT_PATTERN, formatDeliveryBody, splitDisclaimer, styleBodySections, withOpeningLine } from "../src/lib/email/delivery-blocks";

describe("delivery email blocks (client doc 16 Nov, M2)", () => {
  it("splits a single-line disclaimer and a bare Disclaimer: section", () => {
    expect(splitDisclaimer(["Baggage: 20kg", "Ticket Verification Disclaimer: Check your ticket."])).toEqual({
      info: ["Baggage: 20kg"],
      disclaimer: ["Check your ticket."],
    });
    expect(splitDisclaimer(["Verify details.", "Disclaimer:", "No guarantee.", "Meet requirements."])).toEqual({
      info: ["Verify details."],
      disclaimer: ["No guarantee.", "Meet requirements."],
    });
  });

  it("sets apart the first line after the greeting, not the greeting", () => {
    const out = withOpeningLine("Hi Asha,<br><br>Good news! Your visa is approved.<br>Booking ID: X");
    expect(out.startsWith("Hi Asha,")).toBe(true);
    expect(out).toContain('font-size:17px;font-weight:600;line-height:1.45;color:#182A4D">Good news! Your visa is approved.</span>');
    expect(out).toContain("Booking ID: X");
  });

  it("styles Important sections, notes and the disclaimer; leaves other paragraphs alone", () => {
    const body = [
      "Booking ID: 1",
      "",
      "Important: Verify the visa.",
      "",
      "Important Travel Instructions:",
      "• Carry your passport.",
      "",
      "Disclaimer: No guarantee of entry.",
    ].join("<br>");
    const out = styleBodySections(body);
    expect(out.startsWith("Booking ID: 1<p style=")).toBe(true);
    expect(out).toContain('<strong style="font-family:Georgia');
    expect(out).toContain(">Important Travel Instructions</p>");
    expect(out).toContain("• Carry your passport.");
    expect(out).toContain(">Disclaimer</p>");
    expect(out).toContain("No guarantee of entry.");
    expect(out).not.toContain("Disclaimer: No guarantee");
  });

  it("never touches a button / HTML paragraph", () => {
    const button = '<table role="presentation"><tr><td>Download</td></tr></table>';
    expect(formatDeliveryBody(`Hi A,<br><br>${button}`)).toContain(button);
  });

  it("recognises every delivery event that carries these sections", () => {
    for (const event of ["NV_VISA_APPROVED", "NV_PARTIAL_APPROVAL", "VC_VISA_APPROVED_PARTIAL_APPLICANTS", "RVT_TICKET_ISSUED", "SF_15", "VC_PACKAGE_GENERATED", "OUTPUT_DELIVERED"]) {
      expect(DELIVERY_EVENT_PATTERN.test(event)).toBe(true);
    }
    expect(DELIVERY_EVENT_PATTERN.test("SF_1")).toBe(false);
    expect(DELIVERY_EVENT_PATTERN.test("PAYMENT_RECEIVED")).toBe(false);
  });
});
