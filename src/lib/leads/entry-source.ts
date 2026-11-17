import { Prisma } from "../../generated/prisma/client";

import type { EntrySource } from "./entry-source-options";

/** A staff-created lead carries details.manualEntry (its free "source" may still read "Website"). */
const MANUAL: Prisma.LeadWhereInput = { details: { path: ["manualEntry"], equals: true } };
/** Not staff-created: the key is missing / null (AnyNull) or false — a bare NOT would drop rows where it is missing. */
const NOT_MANUAL: Prisma.LeadWhereInput = { OR: [{ details: { path: ["manualEntry"], equals: Prisma.AnyNull } }, { details: { path: ["manualEntry"], equals: false } }] };
const WHATSAPP_SOURCE = "WhatsApp Bot";
const NOT_WHATSAPP: Prisma.LeadWhereInput = { OR: [{ source: null }, { source: { not: WHATSAPP_SOURCE } }] };

/**
 * The lead condition for one entry source (used by the Leads, Quotations and Bookings lists). Always wrapped in `AND`,
 * so it never overwrites a list's own `OR` (ownership, search) when spread into the same where object.
 */
export function entrySourceWhere(source: EntrySource | undefined): Prisma.LeadWhereInput {
  if (source === "MANUAL") return { AND: [MANUAL] };
  if (source === "WHATSAPP") return { AND: [{ source: WHATSAPP_SOURCE }, NOT_MANUAL] };
  if (source === "WEBSITE") return { AND: [NOT_MANUAL, NOT_WHATSAPP] };
  return {};
}
