import { describe, expect, it } from "vitest";
import { newVisaAdditionalTravellerSchema, findNewVisaTravellerIssues } from "../src/lib/validation/new-visa-schema";
import { trackSchema } from "../src/lib/validation/track-schema";

describe("New Visa guardian relationship (client doc 16 Nov, F3)", () => {
  const adult = { fullName: "Asha Rao", passportNumber: "N1234567", dob: "1990-05-01", occupation: "Engineer" };

  it("an adult whose hidden relationship field kept an empty value is accepted", () => {
    expect(newVisaAdditionalTravellerSchema.safeParse({ ...adult, guardianRelationship: "" }).success).toBe(true);
  });

  it("a real choice is still limited to Father / Mother", () => {
    expect(newVisaAdditionalTravellerSchema.safeParse({ ...adult, guardianRelationship: "UNCLE" }).success).toBe(false);
  });

  it("a minor with an empty relationship is still asked to choose one", () => {
    const issues = findNewVisaTravellerIssues({
      travelDate: "2026-12-20",
      dob: "1990-05-01",
      additionalTravellers: [{ dob: "2018-03-01", guardianFullName: "Asha Rao", guardianPassportNumber: "N1234567", guardianRelationship: "" }],
    });
    expect(issues.map((issue) => issue.path)).toEqual(["additionalTravellers.0.guardianRelationship"]);
  });
});

describe("Track lookup verifier (client doc 16 Nov, M3)", () => {
  it("accepts a booking page key from a notification button", () => {
    expect(trackSchema.safeParse({ referenceId: "11126NV001", verifier: "0123456789abcdef0123456789abcdef" }).success).toBe(true);
  });
  it("still rejects anything else", () => {
    expect(trackSchema.safeParse({ referenceId: "11126NV001", verifier: "abc" }).success).toBe(false);
  });
});
