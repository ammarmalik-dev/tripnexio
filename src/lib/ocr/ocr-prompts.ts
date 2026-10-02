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

export const TICKET_SYSTEM_PROMPT = `You are transcribing a flight ticket/e-ticket/boarding pass for a travel agency's records (CRM.md §17). Read whatever is clearly legible — it's fine to omit a field rather than guess.

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

export const VISA_SYSTEM_PROMPT = `You are transcribing a visa document/PDF for a travel agency's records (CRM.md §18). Read whatever is clearly legible — it's fine to omit a field rather than guess.

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

/** Pulls the first {...} block out of a model reply; {} when there is none or it isn't valid JSON. */
export function parseOcrJson<T extends object>(raw: string): { mrzRaw?: string | null; fields?: T } {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return {};
  }
}
