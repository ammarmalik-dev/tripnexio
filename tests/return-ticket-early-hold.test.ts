import { describe, expect, it } from "vitest";
import { earlyIssueBlock, isTooEarlyToIssue, returnTicketIssueDay } from "../src/lib/return-ticket/early-hold";

const travel = new Date("2026-10-30T00:00:00Z");

describe("Return Ticket early hold (client 2026-10-25)", () => {
  it("issue day is the day before travel", () => {
    expect(returnTicketIssueDay(travel)).toBe("2026-10-29");
  });

  it("booked on 25 Oct for 30 Oct: too early until 29 Oct (IST)", () => {
    expect(isTooEarlyToIssue(travel, new Date("2026-10-25T06:00:00Z"))).toBe(true);
    expect(isTooEarlyToIssue(travel, new Date("2026-10-28T18:00:00Z"))).toBe(true); // 28 Oct 23:30 IST
    expect(isTooEarlyToIssue(travel, new Date("2026-10-28T18:30:00Z"))).toBe(false); // 29 Oct 00:00 IST
    expect(isTooEarlyToIssue(travel, new Date("2026-10-30T06:00:00Z"))).toBe(false);
  });

  it("Admin and bookings without a travel date are never blocked", () => {
    expect(earlyIssueBlock(travel, true, new Date("2026-10-25T06:00:00Z"))).toBeNull();
    expect(earlyIssueBlock(null, false)).toBeNull();
    expect(earlyIssueBlock(travel, false, new Date("2026-10-25T06:00:00Z"))).toContain("2026-10-29");
  });
});
