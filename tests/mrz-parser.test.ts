import { describe, expect, it } from "vitest";
import { parseMrz } from "../src/lib/ocr/mrz-parser";

// ICAO Doc 9303 TD3 specimen.
const LINE1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<";
const LINE2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";

describe("parseMrz", () => {
  it("reads and validates the ICAO specimen", () => {
    const result = parseMrz(`${LINE1}\n${LINE2}`);
    expect(result?.valid).toBe(true);
    expect(result?.fields).toMatchObject({
      fullName: "ANNA MARIA ERIKSSON",
      passportNumber: "L898902C3",
      nationality: "UTO",
      dob: "1974-08-12",
      sex: "F",
      expiryDate: "2012-04-15",
    });
  });

  it("tolerates one extra or missing '<' at the end of line 1 (a common vision-model miscount)", () => {
    expect(parseMrz(`${LINE1}<\n${LINE2}`)?.valid).toBe(true);
    expect(parseMrz(`${LINE1.slice(0, -1)}\n${LINE2}`)?.valid).toBe(true);
  });

  it("tolerates a miscounted '<' run in line 2's personal-number field", () => {
    const extra = LINE2.replace("B<<<<<10", "B<<<<<<10");
    const missing = LINE2.replace("B<<<<<10", "B<<<<10");
    expect(parseMrz(`${LINE1}\n${extra}`)?.valid).toBe(true);
    expect(parseMrz(`${LINE1}\n${missing}`)?.valid).toBe(true);
  });

  it("never turns a misread character into a valid MRZ", () => {
    const misread = LINE2.replace("L898902C3", "L898902C8");
    const result = parseMrz(`${LINE1}\n${misread}`);
    expect(result?.valid).toBe(false);
    expect(result?.fields.passportNumberValid).toBe(false);
  });

  it("rejects lines whose extra characters aren't filler", () => {
    expect(parseMrz(`${LINE1}X\n${LINE2}`)).toBeNull();
    expect(parseMrz("not an mrz")).toBeNull();
  });
});
