/** Client doc 16 Nov (J5 / J6) — the two teams staff belong to (null = both). Client-safe (no db import). */
export const STAFF_TEAMS = ["SALES", "OPERATIONS"] as const;
export type StaffTeam = (typeof STAFF_TEAMS)[number];
export const STAFF_TEAM_LABELS: Record<StaffTeam, string> = { SALES: "Sales", OPERATIONS: "Operations" };

/**
 * Client doc 16 Nov (J5) — who owns a new lead: New Visa / OTB / Return Ticket start with Sales (follow-up and
 * payment) and move to Operations once paid; Special Fare / Visa Change / Visa Extension are quoted and processed by
 * Operations from the start.
 */
const SALES_FIRST = new Set(["NEW_VISA", "OTB", "RETURN_TICKET"]);
export function initialTeamFor(serviceType: string): StaffTeam {
  return SALES_FIRST.has(serviceType) ? "SALES" : "OPERATIONS";
}
export function movesToOperationsOnPayment(serviceType: string): boolean {
  return SALES_FIRST.has(serviceType);
}
