/**
 * Client doc 2026-10-27 (A6) — "unable to draft and send a quotation": a Special Fare draft saved with its
 * (≤ 30-minute) validity could never be sent once that time had passed, because "Send" carries no new validity
 * and the send was refused. A draft's clock now restarts when it goes out:
 * - a validity staff set at send time wins;
 * - else the draft's own validity, while it is still in the future;
 * - else (none saved, or already passed) the service's full window from now (`fallback`), when it has one.
 * Pure, so it is unit-tested (tests/quotation-send-validity.test.ts).
 */
export function draftSendValidity(input: { explicit: Date | null; stored: Date | null; fallback: Date | null; now: Date }): Date | null {
  if (input.explicit) return input.explicit;
  if (input.stored && input.stored.getTime() > input.now.getTime()) return input.stored;
  return input.fallback ?? input.stored;
}
