/**
 * P23 — a country's flag for display. `Country.flagOverride` (Admin-set, an
 * emoji or an image URL) wins; otherwise the emoji is derived from the ISO
 * 3166-1 alpha-2 code via Unicode regional-indicator symbols ("AE" → 🇦🇪).
 *
 * Admin country codes aren't always alpha-2 (e.g. "UAE"), so a small alias
 * table maps the ISO alpha-3 codes and common short forms for the Phase 1
 * markets. Anything else without an override gets a neutral globe.
 * Client-safe (no DB import).
 */
export interface CountryFlag {
  kind: "emoji" | "image";
  value: string;
}

const FALLBACK_FLAG = "\u{1F310}"; // 🌐

/** ISO alpha-3 / common short forms → alpha-2. Standard ISO codes only, not business data. */
const CODE_ALIASES: Record<string, string> = {
  UAE: "AE",
  ARE: "AE",
  KSA: "SA",
  SAU: "SA",
  IND: "IN",
  BHR: "BH",
  KWT: "KW",
  OMN: "OM",
  QAT: "QA",
  THA: "TH",
  UK: "GB",
  GBR: "GB",
  USA: "US",
};

const REGIONAL_INDICATOR_A = 0x1f1e6;

function isImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith("/") || /^data:image\//i.test(value);
}

/** "AE" → 🇦🇪; returns null for anything that isn't a two-letter code. */
export function emojiFromIsoCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  const alpha2 = /^[A-Z]{2}$/.test(normalized) ? normalized : CODE_ALIASES[normalized];
  if (!alpha2) return null;
  return String.fromCodePoint(...[...alpha2].map((char) => REGIONAL_INDICATOR_A + char.charCodeAt(0) - 65));
}

/** "AE" / "UAE" → "ae"; null for anything without an ISO alpha-2 code. */
function alpha2For(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  const alpha2 = /^[A-Z]{2}$/.test(normalized) ? normalized : CODE_ALIASES[normalized];
  return alpha2 ? alpha2.toLowerCase() : null;
}

/**
 * Image for a flag string: an image URL as-is, a flag emoji ("🇦🇪") as the
 * self-hosted SVG (/flags/ae.svg, from the MIT-licensed flag-icons set).
 * Emoji flags don't render on Windows, so every on-page flag uses this.
 */
export function flagImageSrc(value: string): string | null {
  const trimmed = value.trim();
  if (isImageUrl(trimmed)) return trimmed;
  const points = [...trimmed].map((char) => char.codePointAt(0) ?? 0);
  if (points.length === 2 && points.every((point) => point >= REGIONAL_INDICATOR_A && point < REGIONAL_INDICATOR_A + 26)) {
    return `/flags/${points.map((point) => String.fromCharCode(point - REGIONAL_INDICATOR_A + 97)).join("")}.svg`;
  }
  return null;
}

export function countryFlag(country: { code: string; flagOverride?: string | null }): CountryFlag {
  const override = country.flagOverride?.trim();
  if (override) {
    const src = flagImageSrc(override);
    return src ? { kind: "image", value: src } : { kind: "emoji", value: override };
  }
  const alpha2 = alpha2For(country.code);
  return alpha2 ? { kind: "image", value: `/flags/${alpha2}.svg` } : { kind: "emoji", value: FALLBACK_FLAG };
}

/**
 * Emoji-only flag for places that can't render images (native <select>
 * options): null for an image override or a code with no derivable flag, so
 * the caller simply shows no prefix.
 */
export function countryFlagEmoji(country: { code: string; flagOverride?: string | null }): string | null {
  const override = country.flagOverride?.trim();
  if (override) return isImageUrl(override) ? null : override;
  return emojiFromIsoCode(country.code);
}

/** "🇦🇪 United Arab Emirates" for a select option label (plain name when there's no emoji). */
export function countryOptionLabel(country: { code: string; name: string; flagOverride?: string | null }): string {
  const emoji = countryFlagEmoji(country);
  return emoji ? `${emoji} ${country.name}` : country.name;
}
