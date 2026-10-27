/**
 * Instructions every OCR provider (Claude, Gemini) sends with a document,
 * kept in one place so swapping the provider never changes what is asked
 * for or the JSON shape that comes back. The MRZ is still validated
 * independently by mrz-parser.ts's check digits, whichever model read it.
 */

export const PASSPORT_SYSTEM_PROMPT = `You are transcribing a passport's photo/bio-data page for a travel agency's records. Two tasks, in order of priority:

1. Find the Machine Readable Zone (MRZ) — the block of two lines of monospaced text at the bottom of the page, made of capital letters, digits, and "<" filler characters, exactly 44 characters per line. Transcribe those two lines EXACTLY as printed, character for character, including every "<". Do not correct, guess, or "fix" anything — if a character is genuinely unreadable, use "<" as the safest default rather than guessing a letter. If there is no visible MRZ (e.g. the image doesn't show the bio page, or it's cropped out), leave this null — do not invent one.

2. Also read the human-readable printed fields on the page as a fallback (full name, passport number, nationality, date of birth, sex, passport expiry date, issuing country) — best-effort, it's fine to leave a field out if it isn't clearly legible.

Respond with ONLY a JSON object, no other text, in this exact shape:
{
  "mrzRaw": "<the two MRZ lines joined by a newline, or null>",
  "fields": {
    "fullName": "<string or omit>",
    "passportNumber": "<string or omit>",
    "nationality": "<string or omit>",
    "dob": "<YYYY-MM-DD or omit>",
    "sex": "<M or F or omit>",
    "expiryDate": "<YYYY-MM-DD or omit>",
    "issuingCountry": "<string or omit>"
  }
}`;

export const TICKET_SYSTEM_PROMPT = `You are transcribing a flight ticket/e-ticket/boarding pass for a travel agency's records (CRM.md §17). Read whatever is clearly legible — it's fine to omit a field rather than guess. If the ticket lists several passengers or flights, report the first passenger and the first flight segment. Put every value inside "fields" using exactly these key names.

Respond with ONLY a JSON object, no other text, in this exact shape:
{
  "fields": {
    "airline": "<string or omit>",
    "flightNumber": "<string or omit>",
    "pnr": "<string or omit>",
    "passengerName": "<string or omit>",
    "departureAirport": "<string or omit>",
    "arrivalAirport": "<string or omit>",
    "departureDate": "<YYYY-MM-DD or omit>",
    "departureTime": "<24h HH:MM or omit>",
    "arrivalDate": "<YYYY-MM-DD or omit>",
    "arrivalTime": "<24h HH:MM or omit>",
    "ticketNumber": "<string or omit>",
    "baggageAllowance": "<string or omit>"
  }
}`;

export const VISA_SYSTEM_PROMPT = `You are transcribing a visa document/PDF for a travel agency's records (CRM.md §18). Read whatever is clearly legible — it's fine to omit a field rather than guess. This may be a visa sticker, an e-visa or an entry permit; the "passengerName" is the visa holder's name. Put every value inside "fields" using exactly these key names.

Respond with ONLY a JSON object, no other text, in this exact shape:
{
  "fields": {
    "passengerName": "<string or omit>",
    "passportNumber": "<string or omit>",
    "visaNumber": "<string or omit>",
    "visaType": "<string or omit>",
    "issueDate": "<YYYY-MM-DD or omit>",
    "expiryDate": "<YYYY-MM-DD or omit>",
    "validity": "<validity as printed, e.g. 'Multiple Entry, 90 days', or omit>"
  }
}`;

export const PASSPORT_USER_PROMPT = "Transcribe this passport's MRZ and readable fields per the instructions.";
export const TICKET_USER_PROMPT = "Transcribe this flight ticket's readable fields per the instructions.";
export const VISA_USER_PROMPT = "Transcribe this visa document's readable fields per the instructions.";

export const OCR_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const OCR_PDF_TYPE = "application/pdf";

/** Throws for anything other than an image or a PDF. */
export function assertOcrMimeType(mimeType: string): void {
  if (mimeType !== OCR_PDF_TYPE && !OCR_IMAGE_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported file type "${mimeType}" — use JPEG, PNG, GIF, WebP, or PDF.`);
  }
}

/** The fields each document type asks for (same keys as the prompts above / types.ts). */
export const PASSPORT_FIELD_KEYS = ["fullName", "givenNames", "surname", "passportNumber", "nationality", "dob", "sex", "expiryDate", "issuingCountry"] as const;
export const TICKET_FIELD_KEYS = [
  "airline",
  "flightNumber",
  "pnr",
  "passengerName",
  "departureAirport",
  "arrivalAirport",
  "departureDate",
  "departureTime",
  "arrivalDate",
  "arrivalTime",
  "ticketNumber",
  "baggageAllowance",
] as const;
export const VISA_FIELD_KEYS = ["passengerName", "passportNumber", "visaNumber", "visaType", "issueDate", "expiryDate", "validity"] as const;

function parseJsonReply(raw: string): unknown {
  // Strip a ```json fence if the model added one.
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    // Fall back to the outermost {...} (or [...]) block inside surrounding prose.
    for (const pattern of [/\{[\s\S]*\}/, /\[[\s\S]*\]/]) {
      const match = text.match(pattern);
      if (!match) continue;
      try {
        return JSON.parse(match[0]);
      } catch {
        // try the next shape
      }
    }
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return asRecord(value[0]);
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

const snakeCase = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/**
 * Client doc 2026-10-27 (C9) — the uploaded visa / return ticket came back with every field empty although the
 * model answered: only `{ "fields": { … } }` was read, so a reply that put the fields at the top level (Gemini in
 * JSON mode often does), wrapped them in an array (one entry per passenger / segment), used snake_case keys, or
 * gave numbers / nulls was dropped as blank. This reads all of those shapes and keeps only the asked-for keys as
 * non-empty strings. Never throws; {} when nothing usable came back.
 */
export function extractOcrFields<T extends object>(raw: string, keys: readonly string[]): { mrzRaw: string | null; fields: T } {
  const root = asRecord(parseJsonReply(raw));
  if (!root) return { mrzRaw: null, fields: {} as T };
  const nested = asRecord(root.fields);
  const fields: Record<string, string> = {};
  for (const key of keys) {
    for (const source of [nested, root]) {
      if (!source) continue;
      const value = source[key] ?? source[snakeCase(key)];
      const text = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
      if (text && text.toLowerCase() !== "null" && text.toLowerCase() !== "omit") {
        fields[key] = text;
        break;
      }
    }
  }
  const mrz = root.mrzRaw ?? root.mrz_raw;
  return { mrzRaw: typeof mrz === "string" && mrz.trim() ? mrz : null, fields: fields as T };
}
