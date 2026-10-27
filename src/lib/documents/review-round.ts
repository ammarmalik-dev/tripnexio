import type { DocumentStatus } from "../../generated/prisma/enums";

/**
 * Client testing 2026-10-09 (E10) — the customer hears about a document
 * review once, not once per document. A "round" is every customer document of
 * the booking (or, before a booking exists, of the passenger). While any of
 * them still waits for staff (RECEIVED) nothing is sent; when none does:
 *   - something rejected / missing  -> one "documents required" message
 *     listing them (with the rejection reasons);
 *   - everything validated          -> one "all documents validated" message.
 * Pure, so the rule is unit-tested; the route supplies the rows.
 */
export interface ReviewRoundDocument {
  type: string;
  status: DocumentStatus;
  rejectionReason: string | null;
  /** Client doc 2026-10-15 (I6) — whose document it is, so the message says which passenger needs what. */
  passengerName?: string | null;
}

export type ReviewRoundOutcome =
  | { kind: "IN_PROGRESS" }
  | { kind: "ALL_VALIDATED"; count: number }
  | { kind: "ACTION_REQUIRED"; summary: string; count: number };

/** "PASSPORT_FRONT" -> "Passport front"; a master name such as "Passport Front Page" is kept as typed. */
export function documentDisplayName(type: string): string {
  if (!/^[A-Z0-9_]+$/.test(type)) return type;
  const words = type.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Client doc 2026-10-15 (I6) — one line per passenger: "Rahul: Passport (blurry), Photo; Priya: Visa copy".
 * Without names (or with one passenger only) it's the plain list "Passport (blurry); Photo".
 */
export function documentsByPassengerSummary(
  items: { passengerName?: string | null; label: string }[],
  /** Client doc 2026-10-27 (C11) — customer messages always say which passenger, even when there is only one. */
  options: { alwaysName?: boolean } = {}
): string {
  const names = new Set(items.map((item) => item.passengerName?.trim() || ""));
  const anyName = [...names].some(Boolean);
  if (names.size <= 1 && !(options.alwaysName && anyName)) return items.map((item) => item.label).join("; ");
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = item.passengerName?.trim() || "Other";
    groups.set(key, [...(groups.get(key) ?? []), item.label]);
  }
  return [...groups.entries()].map(([name, labels]) => `${name}: ${labels.join(", ")}`).join("; ");
}

export function reviewRoundOutcome(documents: ReviewRoundDocument[]): ReviewRoundOutcome {
  if (documents.length === 0 || documents.some((document) => document.status === "RECEIVED")) return { kind: "IN_PROGRESS" };
  const outstanding = documents.filter((document) => document.status === "REJECTED" || document.status === "MISSING");
  if (outstanding.length > 0) {
    const summary = documentsByPassengerSummary(
      outstanding.map((document) => {
        const name = documentDisplayName(document.type);
        return {
          passengerName: document.passengerName,
          label: document.status === "REJECTED" && document.rejectionReason ? `${name} (${document.rejectionReason})` : name,
        };
      }),
      { alwaysName: true }
    );
    return { kind: "ACTION_REQUIRED", summary, count: outstanding.length };
  }
  // Documents not uploaded yet (REQUIRED) are still open — only a fully validated set is announced.
  return documents.every((document) => document.status === "VERIFIED") ? { kind: "ALL_VALIDATED", count: documents.length } : { kind: "IN_PROGRESS" };
}
