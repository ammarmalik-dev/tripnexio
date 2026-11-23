import { describe, expect, it } from "vitest";
import {
  addDays,
  afterExtensionReminderDue,
  crossUpsellDue,
  otbOfferDue,
  returnTicketOfferDue,
  uaeVisaReminderDue,
  visaExtensionUpsellDue,
} from "../src/lib/automation/campaign-schedule";

describe("campaign schedules (N5–N8, N10)", () => {
  it("OTB: day after delivery, then 2 days before travel (1 day when close)", () => {
    expect(otbOfferDue("2026-12-02", "2026-12-01", "2026-12-20")).toBe(1);
    expect(otbOfferDue("2026-12-18", "2026-12-01", "2026-12-20")).toBe(2);
    expect(otbOfferDue("2026-12-10", "2026-12-01", "2026-12-20")).toBeNull();
    // delivered 1 Dec, travel 4 Dec: 1st on 2 Dec, 2nd on 3 Dec (1 day before)
    expect(otbOfferDue("2026-12-02", "2026-12-01", "2026-12-04")).toBe(1);
    expect(otbOfferDue("2026-12-03", "2026-12-01", "2026-12-04")).toBe(2);
    expect(otbOfferDue("2026-12-04", "2026-12-01", "2026-12-04")).toBeNull();
  });
  it("Return Ticket: 3 and 1 day before travel", () => {
    expect(returnTicketOfferDue("2026-12-17", "2026-12-20")).toBe(1);
    expect(returnTicketOfferDue("2026-12-19", "2026-12-20")).toBe(2);
    expect(returnTicketOfferDue("2026-12-18", "2026-12-20")).toBeNull();
  });
  it("Visa Extension upsell: day 50 / 55 / 60 after approval", () => {
    expect(visaExtensionUpsellDue(addDays("2026-10-01", 55), "2026-10-01")).toBe(55);
    expect(visaExtensionUpsellDue(addDays("2026-10-01", 51), "2026-10-01")).toBeNull();
  });
  it("cross upsells: 5 and 2 days before departure", () => {
    expect(crossUpsellDue("2026-12-15", "2026-12-20")).toBe(5);
    expect(crossUpsellDue("2026-12-18", "2026-12-20")).toBe(2);
    expect(crossUpsellDue("2026-12-19", "2026-12-20")).toBeNull();
  });
  it("UAE visa reminders by stay and after an extension", () => {
    expect(uaeVisaReminderDue(addDays("2026-11-01", 25), "2026-11-01", 30)).toBe(25);
    expect(uaeVisaReminderDue(addDays("2026-11-01", 25), "2026-11-01", 60)).toBeNull();
    expect(uaeVisaReminderDue(addDays("2026-11-01", 55), "2026-11-01", 60)).toBe(55);
    expect(afterExtensionReminderDue(addDays("2026-11-01", 29), "2026-11-01")).toBe(29);
    expect(afterExtensionReminderDue(addDays("2026-11-01", 27), "2026-11-01")).toBeNull();
  });
});
