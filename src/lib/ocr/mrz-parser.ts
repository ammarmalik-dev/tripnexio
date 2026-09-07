/**
 * Deterministic parser + checksum validator for the TD3 Machine Readable
 * Zone format (the 2-line, 44-characters-per-line block on a passport's
 * bio-data page) — implements the ICAO Doc 9303 check-digit algorithm from
 * scratch, no library. This is the "ideally via MRZ parsing" part of the
 * OCR task: whatever provider reads the pixels (src/lib/ocr/claude-ocr-provider.ts),
 * THIS function is what actually verifies the reading is internally
 * consistent — a wrong single character almost always fails at least one
 * check digit, which is exactly why MRZ parsing is more trustworthy than
 * reading the printed name/number fields directly.
 *
 * Reference: ICAO Doc 9303 Part 4 (passports), the TD3 format.
 */

const CHAR_VALUES: Record<string, number> = {};
for (let i = 0; i <= 9; i++) CHAR_VALUES[String(i)] = i;
for (let i = 0; i < 26; i++) CHAR_VALUES[String.fromCharCode(65 + i)] = i + 10;
CHAR_VALUES["<"] = 0;

function charValue(c: string): number {
  return CHAR_VALUES[c] ?? 0;
}

/** The standard repeating 7-3-1 weighting used for every MRZ check digit. */
function computeCheckDigit(field: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    sum += charValue(field[i]) * weights[i % 3];
  }
  return sum % 10;
}

/**
 * MRZ dates are 2-digit years (YYMMDD) — genuinely ambiguous which century.
 * A date of birth can never be in the future, so pick whichever century
 * doesn't produce one; an expiry date is assumed current-century (no TD3
 * passport issued this century expires before 2000).
 */
function yymmddToIso(yymmdd: string, bias: "past" | "future"): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10);
  const dd = parseInt(yymmdd.slice(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;

  const currentYY = new Date().getFullYear() % 100;
  const century = bias === "past" ? (yy > currentYY ? 1900 : 2000) : 2000;
  const year = century + yy;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export interface MrzParseResult {
  /** True only if every check digit (including the composite) matches — a strong signal the OCR reading is accurate. */
  valid: boolean;
  fields: {
    documentType?: string;
    issuingCountry?: string;
    surname?: string;
    givenNames?: string;
    fullName?: string;
    passportNumber?: string;
    passportNumberValid: boolean;
    nationality?: string;
    dob?: string;
    dobValid: boolean;
    sex?: string;
    expiryDate?: string;
    expiryValid: boolean;
    personalNumber?: string;
    personalNumberValid: boolean;
    compositeValid: boolean;
  };
  errors: string[];
}

/**
 * Parses a raw two-line MRZ block. Returns null if the input isn't
 * shaped like a TD3 MRZ at all (wrong line count/length, not a passport
 * document code) — a genuine "couldn't find an MRZ" case, distinct from
 * "found one but a checksum failed" (which still returns a result, just
 * with `valid: false` and the specific failing field(s) flagged).
 */
export function parseMrz(rawInput: string): MrzParseResult | null {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim().toUpperCase().replace(/\s+/g, ""))
    .filter((line) => line.length > 0);
  if (lines.length < 2) return null;

  const [line1, line2] = lines.slice(-2);
  if (line1.length !== 44 || line2.length !== 44) return null;
  if (line1[0] !== "P") return null;

  const errors: string[] = [];

  const issuingCountry = line1.slice(2, 5).replace(/</g, "");
  const nameField = line1.slice(5, 44);
  const [surnamePart, givenPart = ""] = nameField.split("<<");
  const surname = surnamePart.replace(/</g, " ").trim() || undefined;
  const givenNames = givenPart.replace(/</g, " ").trim() || undefined;
  const fullName = [givenNames, surname].filter(Boolean).join(" ").trim() || undefined;

  const passportNumberRaw = line2.slice(0, 9);
  const passportNumberCheck = line2[9];
  const passportNumber = passportNumberRaw.replace(/</g, "") || undefined;
  const passportNumberValid = String(computeCheckDigit(passportNumberRaw)) === passportNumberCheck;
  if (!passportNumberValid) errors.push("Passport number check digit mismatch");

  const nationality = line2.slice(10, 13).replace(/</g, "") || undefined;

  const dobRaw = line2.slice(13, 19);
  const dobCheck = line2[19];
  const dobValid = String(computeCheckDigit(dobRaw)) === dobCheck;
  if (!dobValid) errors.push("Date of birth check digit mismatch");

  const sexRaw = line2[20];
  const sex = sexRaw === "<" ? undefined : sexRaw;

  const expiryRaw = line2.slice(21, 27);
  const expiryCheck = line2[27];
  const expiryValid = String(computeCheckDigit(expiryRaw)) === expiryCheck;
  if (!expiryValid) errors.push("Expiry date check digit mismatch");

  const personalNumberRaw = line2.slice(28, 42);
  const personalNumberCheck = line2[42];
  const personalNumber = personalNumberRaw.replace(/</g, "") || undefined;
  // The personal-number check digit is allowed to be '<' when the field itself is unused — that's valid by spec, not a failure.
  const personalNumberValid = personalNumberCheck === "<" || String(computeCheckDigit(personalNumberRaw)) === personalNumberCheck;
  if (!personalNumberValid) errors.push("Personal number check digit mismatch");

  const compositeField = passportNumberRaw + passportNumberCheck + dobRaw + dobCheck + expiryRaw + expiryCheck + personalNumberRaw + personalNumberCheck;
  const compositeCheck = line2[43];
  const compositeValid = String(computeCheckDigit(compositeField)) === compositeCheck;
  if (!compositeValid) errors.push("Composite check digit mismatch");

  return {
    valid: passportNumberValid && dobValid && expiryValid && compositeValid,
    fields: {
      documentType: line1.slice(0, 2).replace(/</g, "") || undefined,
      issuingCountry,
      surname,
      givenNames,
      fullName,
      passportNumber,
      passportNumberValid,
      nationality,
      dob: yymmddToIso(dobRaw, "past"),
      dobValid,
      sex,
      expiryDate: yymmddToIso(expiryRaw, "future"),
      expiryValid,
      personalNumber,
      personalNumberValid,
      compositeValid,
    },
    errors,
  };
}
