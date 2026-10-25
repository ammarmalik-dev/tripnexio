import { describe, expect, it } from "vitest";
import { cleanSubServiceCodes, leadSubServiceCodes, vendorCoversSubService } from "../src/lib/vendors/sub-service-match";
import { parseVendorSubServicesCell } from "../src/lib/csv/import/vendors";

describe("vendor sub-service coverage (Admin handover §12)", () => {
  const known = ["airport_to_airport", "border_exit"];

  it("reads the lead's sub-service from its details, limited to master codes", () => {
    expect(leadSubServiceCodes({ changeType: "AIRPORT_TO_AIRPORT" }, known)).toEqual(["airport_to_airport"]);
    expect(leadSubServiceCodes({ subServiceCode: "border_exit" }, known)).toEqual(["border_exit"]);
    expect(leadSubServiceCodes({ visaType: "Free text type" }, known)).toEqual([]);
    expect(leadSubServiceCodes(null, known)).toEqual([]);
    expect(leadSubServiceCodes({ subServiceId: "ss1" }, known, new Map([["ss1", "border_exit"]]))).toEqual(["border_exit"]);
  });

  it("an empty vendor list covers everything; a lead without sub-service matches every vendor", () => {
    expect(vendorCoversSubService([], ["border_exit"])).toBe(true);
    expect(vendorCoversSubService(["airport_to_airport"], [])).toBe(true);
  });

  it("a restricted vendor only covers its own sub-services", () => {
    expect(vendorCoversSubService(["airport_to_airport"], ["airport_to_airport"])).toBe(true);
    expect(vendorCoversSubService(["airport_to_airport"], ["border_exit"])).toBe(false);
    expect(vendorCoversSubService(["Airport To Airport"], ["airport_to_airport"])).toBe(true);
  });

  it("cleans saved codes against the service's master", () => {
    expect(cleanSubServiceCodes(["Border Exit", "border_exit", "nope"], known)).toEqual({ codes: ["border_exit"], unknown: ["nope"] });
  });

  it("parses the CSV sub_services cell", () => {
    const codes = new Map([["VISA_CHANGE", new Set(known)]]);
    const ok = parseVendorSubServicesCell("VISA_CHANGE:border_exit|OTB:*", ["VISA_CHANGE", "OTB"], codes);
    expect(ok.errors).toEqual([]);
    expect(ok.byService.get("VISA_CHANGE")).toEqual(["border_exit"]);
    expect(ok.byService.get("OTB")).toEqual([]);
    expect(parseVendorSubServicesCell("VISA_CHANGE:unknown", ["VISA_CHANGE"], codes).errors).toHaveLength(1);
    expect(parseVendorSubServicesCell("NEW_VISA:x", ["VISA_CHANGE"], codes).errors).toHaveLength(1);
    expect(parseVendorSubServicesCell("", ["VISA_CHANGE"], codes).byService.size).toBe(0);
  });
});
