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
 * history in the order they happened) or is on now. Labels repeat across statuses (e.g. two "Documents
 * Required"), so they're merged. Once the booking is on a final status nothing is left upcoming.
 *
 * With a status history, a main step before the current one that the booking never went through (e.g.
 * "Sent to Airlines" when it was never sent) is left out instead of being shown as done, and the steps that
 * happened are listed in the order they happened (a hold sits where it happened, not at the end). Steps
 * before the first recorded one (the lead stage, e.g. "Payment Pending") count as done. Records older than
 * the history fall back to "every main step before the current one is done".
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

  // Client doc 2026-10-27 (C7) — the order the booking actually went through its statuses.
  const history = [...reachedIds];
  const hasHistory = history.length > 0;
  const reachedMainOrders = labelled.filter((status) => reachedIds.has(status.id) && !isBranchStatus(status)).map((status) => status.displayOrder);
  const firstRecorded = reachedMainOrders.length > 0 ? Math.min(...reachedMainOrders) : Number.POSITIVE_INFINITY;
  const beforeCurrent = (status: StageStatus) => !!currentStep && status.displayOrder < currentStep.displayOrder;
  const preHistory = (status: StageStatus) => hasHistory && !reachedIds.has(status.id) && status.displayOrder < firstRecorded;

  const shown = labelled.filter((status) => {
    if (status.id === currentStep?.id) return true;
    const detour = (status.customerLabel ?? "").toLowerCase().startsWith("additional documents");
    if (isBranchStatus(status) || detour) return reachedIds.has(status.id);
    // A main step the booking skipped is not shown as done.
    if (hasHistory && beforeCurrent(status) && !reachedIds.has(status.id) && !preHistory(status)) return false;
    return true;
  });

  const stateOf = (status: StageStatus): CustomerStageStatus => {
    if (status.id === currentStep?.id) return "current";
    if (reachedIds.has(status.id)) return "done";
    if (preHistory(status)) return "done";
    if (!hasHistory && beforeCurrent(status) && !status.isTerminal) return "done";
    return "upcoming";
  };

  // Done steps in the order they happened, then the current step, then what's still to come.
  const sortKey = (status: StageStatus, state: CustomerStageStatus): [number, number] => {
    if (!hasHistory) return [0, status.displayOrder];
    if (state === "upcoming") return [3, status.displayOrder];
    if (state === "current") return [2, 0];
    if (preHistory(status)) return [0, status.displayOrder];
    return [1, history.indexOf(status.id)];
  };
  const ordered = shown
    .map((status) => ({ status, state: stateOf(status) }))
    .map((entry) => ({ ...entry, key: sortKey(entry.status, entry.state) }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1]);

  const merged: { label: string; status: CustomerStageStatus }[] = [];
  const rank: Record<CustomerStageStatus, number> = { upcoming: 0, done: 1, current: 2 };
  for (const { status, state } of ordered) {
    const label = (status.customerLabel as string).trim();
    if (finished && state === "upcoming") continue;
    const existing = merged.find((entry) => entry.label === label);
    if (existing) {
      if (rank[state] > rank[existing.status]) existing.status = state;
      continue;
    }
    merged.push({ label, status: state });
  }
  // A label merged into an earlier "done" entry that is now current moves to the current position.
  const currentIndex = merged.findIndex((entry) => entry.status === "current");
  if (currentIndex >= 0) {
    const [entry] = merged.splice(currentIndex, 1);
    const firstUpcoming = merged.findIndex((item) => item.status === "upcoming");
    merged.splice(firstUpcoming < 0 ? merged.length : firstUpcoming, 0, entry);
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
