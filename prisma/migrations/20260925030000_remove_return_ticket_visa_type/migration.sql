-- Client update (2026-09-24): Return Ticket no longer asks the customer to
-- select a visa type/validity — they give an Expected Return Date instead.
-- Drops the now-unused per-destination validity-option list and the whole
-- day-offset rule config it fed into.

ALTER TABLE "ReturnTicketDestination" DROP COLUMN "validityOptions";

DROP TABLE "ReturnTicketRuleConfig";

-- Also drops the ReturnTicketVisaType enum type — it was never actually
-- referenced by any table column (a genuinely orphaned leftover from an
-- earlier iteration, confirmed via grep before this migration was written).
DROP TYPE "ReturnTicketVisaType";
