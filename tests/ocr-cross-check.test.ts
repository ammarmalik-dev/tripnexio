import { describe, expect, it } from "vitest";
import { compareWithEntered, namesMatch } from "../src/lib/ocr/cross-check";

describe("OCR cross-check (client doc 2026-10-15, J4)", () => {
  it("matches names regardless of order, case and middle names", () => {
    expect(namesMatch("Rahul Kumar", "KUMAR RAHUL")).toBe(true);
    expect(namesMatch("Rahul Kumar", "RAHUL KUMAR SHARMA")).toBe(true);
    expect(namesMatch("Rahul Kumar", "PRIYA SHARMA")).toBe(false);
  });
  it("validates when every compared field matches", () => {
    const result = compareWithEntered({ name: "KUMAR RAHUL", passportNumber: "Z 1234567", dob: "1990-05-01" }, { fullName: "Rahul Kumar", passportNumber: "z1234567", dob: "1990-05-01T00:00:00Z" });
    expect(result.status).toBe("VALIDATED");
    expect(result.checked).toEqual(["Passport number", "Name", "Date of birth"]);
  });
  it("asks for manual validation on any difference, listing it", () => {
    const result = compareWithEntered({ passportNumber: "X0000000", expiryDate: "2026-11-01" }, { passportNumber: "Z1234567", visaExpiryDate: "2026-10-30" });
    expect(result.status).toBe("MISMATCH");
    expect(result.mismatches.map((m) => m.field)).toEqual(["Passport number", "Visa expiry"]);
  });
  it("is unchecked when nothing can be compared", () => {
    expect(compareWithEntered({ name: "A" }, {}).status).toBe("UNCHECKED");
  });
});
