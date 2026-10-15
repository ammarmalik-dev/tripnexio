import { describe, expect, it } from "vitest";
import { a2aFlightsFromBlock, a2aFlightsSchema, type A2AFlightsInput } from "@/lib/visa-change/a2a-flights";
import { customerBlockRows, visaChangeQuoteBlockReason, type A2ABlock } from "@/lib/visa-change/operational";

const flights: A2AFlightsInput = {
  exitFromAirportCode: "DXB",
  exitToAirportCode: "MCT",
  exitAirlineCode: "G9",
  exitFlightNumber: "G9 101",
  exitDepartAt: "2026-10-20T10:30",
  reentryFromAirportCode: "MCT",
  reentryToAirportCode: "DXB",
  reentryAirlineCode: "G9",
  reentryFlightNumber: "G9 102",
  reentryDepartAt: "2026-10-20T13:00",
  reportingTime: "3 hours before departure",
};

const block: A2ABlock = {
  kind: "A2A",
  exitAirportId: "a1",
  exitAirportCode: "DXB",
  exitAirport: "Dubai International (DXB)",
  exitToAirportCode: "MCT",
  exitToAirport: "Muscat International (MCT)",
  reentryFromAirportCode: "MCT",
  reentryFromAirport: "Muscat International (MCT)",
  entryAirportId: "a1",
  entryAirportCode: "DXB",
  entryAirport: "Dubai International (DXB)",
  airlineCode: "G9",
  airline: "Air Arabia",
  flightNumber: "G9 101",
  flightDate: "2026-10-20",
  flightTime: "10:30",
  returnAirlineCode: "G9",
  returnAirline: "Air Arabia",
  returnFlightNumber: "G9 102",
  returnFlightDate: "2026-10-20",
  returnFlightTime: "13:00",
  reportingTime: "3 hours before departure",
  vendorId: "v1",
  vendorName: "Vendor",
  cost: 9000,
  sellingPrice: 12000,
};

describe("Visa Change A2A per-option flights (B32)", () => {
  it("needs both legs complete, different airports per leg, and re-entry after exit", () => {
    expect(a2aFlightsSchema.safeParse(flights).success).toBe(true);
    expect(a2aFlightsSchema.safeParse({ ...flights, exitFlightNumber: "" }).success).toBe(false);
    expect(a2aFlightsSchema.safeParse({ ...flights, exitToAirportCode: "DXB" }).success).toBe(false);
    expect(a2aFlightsSchema.safeParse({ ...flights, reentryDepartAt: "2026-10-20T09:00" }).success).toBe(false);
  });

  it("round-trips a saved option back into the form, and older blocks start empty", () => {
    expect(a2aFlightsFromBlock(block)).toEqual({ ...flights, exitTerminal: "", reentryTerminal: "" });
    expect(a2aFlightsFromBlock({ ...block, exitToAirportCode: null })).toBeNull();
  });

  it("shows the customer both legs and never vendor, cost or price", () => {
    const rows = customerBlockRows(block);
    expect(rows.map((row) => row.label)).toEqual(["Exit Flight", "Re-entry Flight", "Reporting Time"]);
    expect(rows[1].value).toContain("Muscat International (MCT) → Dubai International (DXB)");
    expect(JSON.stringify(rows)).not.toMatch(/9000|12000|Vendor/);
  });

  it("no longer needs lead-level details before quoting an A2A lead", () => {
    expect(visaChangeQuoteBlockReason("VISA_CHANGE", { changeType: "AIRPORT_TO_AIRPORT" })).toBeNull();
    expect(visaChangeQuoteBlockReason("VISA_CHANGE", { changeType: "BORDER_EXIT" })).toMatch(/Border Exit/);
  });
});
