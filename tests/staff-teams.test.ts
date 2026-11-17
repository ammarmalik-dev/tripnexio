import { describe, expect, it } from "vitest";
import { initialTeamFor, movesToOperationsOnPayment } from "../src/lib/staff/teams";

describe("lead ownership by team (client doc 16 Nov, J5)", () => {
  it("New Visa / OTB / Return Ticket start with Sales and move to Operations when paid", () => {
    for (const service of ["NEW_VISA", "OTB", "RETURN_TICKET"]) {
      expect(initialTeamFor(service)).toBe("SALES");
      expect(movesToOperationsOnPayment(service)).toBe(true);
    }
  });
  it("Special Fare / Visa Change / Visa Extension stay with Operations from the start", () => {
    for (const service of ["FLIGHT_SPECIAL_FARE", "VISA_CHANGE", "VISA_EXTENSION"]) {
      expect(initialTeamFor(service)).toBe("OPERATIONS");
      expect(movesToOperationsOnPayment(service)).toBe(false);
    }
  });
});
