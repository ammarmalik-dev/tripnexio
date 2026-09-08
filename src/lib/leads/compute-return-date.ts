import type { ReturnTicketRules } from "../settings/return-ticket-rule-config";

export type ReturnTicketVisaType = "THIRTY_DAYS" | "SIXTY_DAYS";

/**
 * Return_Verified_Ticket.md §5/§6, locked: "Customer selects only the
 * travel date. The customer does not select the return/onward date... The
 * return/onward date is generated according to the selected UAE visa type
 * [and] the configured TripNexio business rule." Computed server-side —
 * never accepted from the client, same never-trust-the-client pattern as
 * Quotation.margin/Refund.refundAmount/Flight_Special_Fare's PaxType.
 *
 * `travelDate` is a "YYYY-MM-DD" string, which `new Date(...)` parses as
 * UTC midnight per the ES spec — offsetting via setUTCDate (not local
 * setDate) keeps the whole calculation on that same UTC-midnight footing,
 * avoiding the local-vs-UTC boundary bug already caught once in
 * flight-special-fare-schema.ts (see that file's history).
 */
export function computeReturnDate(travelDate: string, visaType: ReturnTicketVisaType, rules: ReturnTicketRules): string {
  const offsetDays = visaType === "THIRTY_DAYS" ? rules.thirtyDayOffsetDays : rules.sixtyDayOffsetDays;
  const d = new Date(travelDate);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
