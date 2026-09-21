import { db } from "../db";

/**
 * A true singleton row, fetched/updated by this fixed id — same pattern as
 * src/lib/settings/tax-fee-config.ts. Return_Verified_Ticket.md §6 locks
 * that the day-offset rule "must be configurable rather than hard-coded".
 */
export const RETURN_TICKET_RULE_CONFIG_ID = "singleton";

// Literal reading of "the configured 30-day rule"/"the configured 60-day
// rule" — travelDate + N days, N matching the visa-type name. Only used if
// the seeded singleton row is somehow missing.
const FALLBACK_THIRTY_DAY_OFFSET_DAYS = 30;
const FALLBACK_SIXTY_DAY_OFFSET_DAYS = 60;
const FALLBACK_NINETY_DAY_OFFSET_DAYS = 90;

export interface ReturnTicketRules {
  thirtyDayOffsetDays: number;
  sixtyDayOffsetDays: number;
  ninetyDayOffsetDays: number;
}

/** Reads the current return/onward-date offset rule — used by computeReturnDate() at lead-creation time. */
export async function getReturnTicketRules(): Promise<ReturnTicketRules> {
  const config = await db.returnTicketRuleConfig.findUnique({ where: { id: RETURN_TICKET_RULE_CONFIG_ID } });
  if (!config) {
    return {
      thirtyDayOffsetDays: FALLBACK_THIRTY_DAY_OFFSET_DAYS,
      sixtyDayOffsetDays: FALLBACK_SIXTY_DAY_OFFSET_DAYS,
      ninetyDayOffsetDays: FALLBACK_NINETY_DAY_OFFSET_DAYS,
    };
  }
  return {
    thirtyDayOffsetDays: config.thirtyDayOffsetDays,
    sixtyDayOffsetDays: config.sixtyDayOffsetDays,
    ninetyDayOffsetDays: config.ninetyDayOffsetDays,
  };
}
