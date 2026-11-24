import { describe, expect, it } from "vitest";
import { buildWorkflow, statusAppliesToCountry } from "../src/lib/service-status/status-countries";

const base = { customerLabel: null, isTerminal: false, active: true, transitions: [] as { toStatusId: string }[] };

describe("statuses per Service x Country (G1)", () => {
  it("a status with no countries applies everywhere", () => {
    expect(statusAppliesToCountry({ countryIds: [] }, "AE")).toBe(true);
    expect(statusAppliesToCountry({ countryIds: [] }, null)).toBe(true);
  });
  it("a country status applies only to its countries", () => {
    expect(statusAppliesToCountry({ countryIds: ["AE"] }, "AE")).toBe(true);
    expect(statusAppliesToCountry({ countryIds: ["AE"] }, "TH")).toBe(false);
    expect(statusAppliesToCountry({ countryIds: ["AE"] }, null)).toBe(false);
  });
  it("the workflow lists active statuses of the country in order with their next moves", () => {
    const statuses = [
      { ...base, id: "b", name: "Applied", displayOrder: 2, countryIds: [], transitions: [{ toStatusId: "c" }, { toStatusId: "d" }] },
      { ...base, id: "a", name: "Received", displayOrder: 1, countryIds: [], transitions: [{ toStatusId: "b" }] },
      { ...base, id: "c", name: "Approved", displayOrder: 3, countryIds: ["TH"], isTerminal: true },
      { ...base, id: "d", name: "Rejected", displayOrder: 4, countryIds: [], isTerminal: true },
      { ...base, id: "e", name: "Old", displayOrder: 5, countryIds: [], active: false },
    ];
    const ae = buildWorkflow(statuses, "AE");
    expect(ae.map((step) => step.name)).toEqual(["Received", "Applied", "Rejected"]);
    expect(ae[1].next).toEqual(["Rejected"]);
    expect(buildWorkflow(statuses, "TH")[1].next).toEqual(["Approved", "Rejected"]);
    expect(buildWorkflow(statuses, null).map((step) => step.name)).toEqual(["Received", "Applied", "Approved", "Rejected"]);
  });
});
