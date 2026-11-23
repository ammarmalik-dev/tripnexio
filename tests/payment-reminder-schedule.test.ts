import { describe, expect, it } from "vitest";
import { reminderCooldownMs } from "../src/lib/automation/payment-reminder-schedule";

const IST = 330 * 60 * 1000;
const at = (iso: string) => new Date(iso);
const clockAt = (iso: string) => {
  const local = new Date(at(iso).getTime() + IST);
  return { date: local.toISOString().slice(0, 10), hour: local.getUTCHours(), offsetMs: IST };
};
const run = (serviceType: string, created: string, now: string, purpose = "INITIAL") =>
  reminderCooldownMs({ serviceType, purpose, createdAt: at(created), now: at(now).getTime(), clock: clockAt(now) });

describe("payment reminder schedule (N3)", () => {
  it("flight: 10 and 20 minutes after, none after 30", () => {
    expect(run("FLIGHT_SPECIAL_FARE", "2026-11-24T05:00:00Z", "2026-11-24T05:05:00Z")).toBeNull();
    expect(run("FLIGHT_SPECIAL_FARE", "2026-11-24T05:00:00Z", "2026-11-24T05:10:00Z")).toBe(9 * 60 * 1000);
    expect(run("FLIGHT_SPECIAL_FARE", "2026-11-24T05:00:00Z", "2026-11-24T05:31:00Z")).toBeNull();
  });
  it("visa change / extension: every 2 h until 6 PM the same local day", () => {
    // 10:30 IST created, 12:30 IST now -> due
    expect(run("VISA_CHANGE", "2026-11-24T05:00:00Z", "2026-11-24T07:00:00Z")).not.toBeNull();
    // 18:30 IST -> none
    expect(run("VISA_EXTENSION", "2026-11-24T05:00:00Z", "2026-11-24T13:00:00Z")).toBeNull();
    // next day -> none
    expect(run("VISA_CHANGE", "2026-11-24T05:00:00Z", "2026-11-25T05:00:00Z")).toBeNull();
  });
  it("new visa / OTB / return ticket: daily from 2 h", () => {
    expect(run("NEW_VISA", "2026-11-24T05:00:00Z", "2026-11-24T06:00:00Z")).toBeNull();
    expect(run("OTB", "2026-11-24T05:00:00Z", "2026-11-25T05:00:00Z")).toBe(24 * 3600 * 1000 - 30 * 60 * 1000);
  });
  it("an extra payment follows the daily rule for every service", () => {
    expect(run("FLIGHT_SPECIAL_FARE", "2026-11-24T05:00:00Z", "2026-11-24T05:10:00Z", "EXTRA")).toBeNull();
    expect(run("VISA_CHANGE", "2026-11-24T05:00:00Z", "2026-11-25T05:00:00Z", "EXTRA")).not.toBeNull();
  });
});
