/**
 * The four locked brand colours for server-rendered PDFs (pdfkit can't read
 * CSS variables). Mirrors the raw --tn-* tokens in src/app/globals.css —
 * change both together when re-branding.
 */
export const PDF_BRAND = {
  deepNavy: "#182a4d",
  electricBlue: "#3e6fdb",
  warmWhite: "#f7f5f0",
  inkBlack: "#111318",
  /** Neutral text tones used alongside the brand colours. */
  mutedText: "#555555",
  hairline: "#d9dce3",
} as const;
