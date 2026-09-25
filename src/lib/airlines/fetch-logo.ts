/**
 * Item 12 (client-message/PENDING_WORK_PROMPTS.md, Admin FINAL handover
 * §11) — a free, keyless logos-by-IATA-code source. This is a genuinely
 * free/no-signup hotlinked image URL (no API key, no cost), which is why
 * it was picked without waiting on a client decision — the prompt's own
 * instruction only asked to confirm before committing to a PAID source.
 * It comes with no uptime/SLA guarantee from a third party, so this is
 * disclosed as a "good enough to start" choice, not a permanent
 * commitment: swap this one function (and nothing else) if the client
 * wants a different or paid source later (e.g. a proper aviation-data
 * API with a real contract).
 */
export function buildAirlineLogoUrl(iataCode: string): string {
  return `https://images.kiwi.com/airlines/64/${iataCode.trim().toUpperCase()}.png`;
}
