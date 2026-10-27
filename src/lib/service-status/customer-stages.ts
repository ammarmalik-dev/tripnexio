/**
 * Client doc 2026-10-27 (C7) — the customer's Track Status steps. The default path lists only the main
 * happy-path steps (Payment Received → Documents → Sent to Airlines → OTB Approved…); a branch outcome
 * (approved for some applicants, rejected, cancelled, a refund step, documents re-requested, on hold, a
 * Special Fare seat unavailable / alternative, an expired quotation…) appears only once the booking has
 * actually been on it. Pure, so it is unit-tested.
 */

export interface StageStatus {
  id: string;
  name: string;
  customerLabel: string | null;
  displayOrder: number;
  systemEvent: string | null;
  isTerminal: boolean;
  mapsToBookingStatus: string | null;
}

export type CustomerStageStatus = "done" | "current" | "upcoming";

const BRANCH_EVENTS = new Set([
  "PARTIAL_APPROVED",
  "DOCUMENTS_REJECTED",
  "EMBASSY_REJECTED",
  "EXTENSION_NOT_ACCEPTED",
  "EXTENSION_REJECTED",
  "OTB_REJECTED",
  "OTB_UNABLE_TO_PROCESS",
  "CANCELLED",
  "REFUND_RAISED",
  "REFUND_APPROVED",
  "REFUND_COMPLETED",
  "REFUND_PARTIALLY_COMPLETED",
  "CANCELLED_AND_REFUNDED",
  "FSF_SEAT_UNAVAILABLE",
  "FSF_ALTERNATIVE_OFFERED",
  "FSF_ADDITIONAL_PAYMENT_PENDING",
  "FSF_REFUND_PENDING",
  "QUOTE_EXPIRING",
  "QUOTE_EXPIRED",
  "NEW_QUOTE_REQUESTED",
  "ON_HOLD",
]);

const BRANCH_NAME = /partial|reject|cancel|refund|unable|not responding|not accepted|not eligible|unavailable|alternative|additional payment|on hold|expir/i;

/** A side outcome rather than a step every booking passes through. */
export function isBranchStatus(status: Pick<StageStatus, "name" | "systemEvent" | "mapsToBookingStatus">): boolean {
  if (status.systemEvent && BRANCH_EVENTS.has(status.systemEvent)) return true;
  if (status.mapsToBookingStatus === "CANCELLED" || status.mapsToBookingStatus === "REFUNDED") return true;
  return BRANCH_NAME.test(status.name);
}

/**
 * The steps to show: main steps, plus the branches the booking has been on (`reachedIds`, from its status
 * history) or is on now. A step is done when it was reached (or, for records older than the history, when it
 * lies before the current step and isn't a final outcome); once the booking is on a final status nothing is
 * left upcoming. Labels repeat across statuses (e.g. two "Documents Required"), so they're merged.
 */
export function customerStages(
  statuses: StageStatus[],
  current: Pick<StageStatus, "id" | "displayOrder"> | null,
  reachedIds: ReadonlySet<string> = new Set()
): { label: string; status: CustomerStageStatus }[] {
  const labelled = statuses.filter((status) => status.customerLabel?.trim()).sort((a, b) => a.displayOrder - b.displayOrder);
  const currentRow = current ? (statuses.find((status) => status.id === current.id) ?? null) : null;
  // The labelled step the booking is on: its own, else the last main step before it.
  const currentStep =
    labelled.find((status) => status.id === current?.id) ??
    [...labelled].reverse().find((status) => !isBranchStatus(status) && current !== null && status.displayOrder <= current.displayOrder) ??
    null;
  const finished = !!currentRow && currentRow.isTerminal;

  const shown = labelled.filter((status) => {
    if (status.id === currentStep?.id) return true;
    const detour = (status.customerLabel ?? "").toLowerCase().startsWith("additional documents");
    if (isBranchStatus(status) || detour) return reachedIds.has(status.id);
    return true;
  });

  const stateOf = (status: StageStatus): CustomerStageStatus => {
    if (status.id === currentStep?.id) return "current";
    if (reachedIds.has(status.id)) return "done";
    if (currentStep && status.displayOrder < currentStep.displayOrder && !status.isTerminal) return "done";
    return "upcoming";
  };

  const merged: { label: string; status: CustomerStageStatus }[] = [];
  const rank: Record<CustomerStageStatus, number> = { upcoming: 0, done: 1, current: 2 };
  for (const status of shown) {
    const label = (status.customerLabel as string).trim();
    const state = stateOf(status);
    if (finished && state === "upcoming") continue;
    const existing = merged.find((entry) => entry.label === label);
    if (existing) {
      if (rank[state] > rank[existing.status]) existing.status = state;
      continue;
    }
    merged.push({ label, status: state });
  }
  return merged;
}

/** Status names a booking has been moved to, read from its audit notes ("A -> B[ …]", "Admin override: A -> B…"). */
export function reachedStatusNames(notes: (string | null)[]): Set<string> {
  const names = new Set<string>();
  for (const note of notes) {
    const match = note?.match(/ -> (.+?)(?: \[|: | \(|$)/);
    if (match?.[1]) names.add(match[1].trim());
  }
  return names;
}
