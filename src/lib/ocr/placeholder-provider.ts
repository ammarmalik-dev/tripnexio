import type { OcrProvider, ExtractPassportInput } from "./provider";
import type { PassportOcrResult } from "./types";

/**
 * Selected automatically by getOcrProvider() when ANTHROPIC_API_KEY is
 * unset/still a placeholder — lets the rest of the pipeline (upload ->
 * provider -> MRZ checksum validation -> PassportExtraction row -> review
 * UI -> confirm-and-apply) be exercised end-to-end without a real key, same
 * role as MockPaymentGateway/ConsoleEmailSender/KeywordAiProvider.
 *
 * Unlike those, this CANNOT plausibly simulate reading the actual uploaded
 * image (there's no non-ML way to "mock" optical character recognition) —
 * so it always returns the same canned, clearly-labeled SAMPLE MRZ
 * regardless of what was uploaded. That sample is the fictional specimen
 * from ICAO Doc 9303 itself (ERIKSSON, ANNA MARIA / Utopia) — a real,
 * checksum-valid MRZ, so mrz-parser.ts's validation genuinely runs and
 * genuinely passes, proving that half of the pipeline for real. The
 * `providerName` and every caller's UI must make it unmistakable this
 * wasn't read from the customer's own image.
 */
export class PlaceholderOcrProvider implements OcrProvider {
  readonly providerName = "placeholder (no ANTHROPIC_API_KEY configured — SAMPLE data, not read from the uploaded image)";

  async extractPassport(_input: ExtractPassportInput): Promise<PassportOcrResult> {
    return {
      provider: this.providerName,
      mrzRaw: "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10",
      fields: {},
    };
  }
}
