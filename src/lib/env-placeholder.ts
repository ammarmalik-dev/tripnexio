/**
 * Shared by every swappable-service factory (payment gateway, email sender,
 * …) that auto-selects a real integration once its env vars are filled in
 * and falls back to a dev-only stand-in until then. Empty/whitespace values
 * and anything still starting with "TODO" (the placeholder convention used
 * throughout .env/.env.example) count as "not configured yet."
 */
export function isPlaceholder(value: string | undefined): boolean {
  return !value || value.trim() === "" || value.trim().toUpperCase().startsWith("TODO");
}
