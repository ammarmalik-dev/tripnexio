import { describe, expect, it } from "vitest";
import { DEFAULT_OUTPUT_BY_SERVICE, OUTPUTS_BY_SERVICE } from "../src/lib/outputs/output-types";

describe("deliverable outputs per service (client testing 2026-10-09, E11)", () => {
  it("each service's usual output is the first one it may deliver", () => {
    for (const [service, outputs] of Object.entries(OUTPUTS_BY_SERVICE)) {
      if (outputs.length === 0) continue;
      expect(outputs).toContain(DEFAULT_OUTPUT_BY_SERVICE[service as keyof typeof DEFAULT_OUTPUT_BY_SERVICE]);
    }
  });

  it("an OTB has no document to upload — it's the airline's confirmation (client doc 2026-10-15, I3)", () => {
    expect(OUTPUTS_BY_SERVICE.OTB).toEqual([]);
  });

  it("a ticket booking can't receive a visa and a visa booking can't receive a ticket", () => {
    expect(OUTPUTS_BY_SERVICE.FLIGHT_SPECIAL_FARE).not.toContain("VISA_PDF");
    expect(OUTPUTS_BY_SERVICE.NEW_VISA).not.toContain("TICKET_PDF");
  });
});
