-- Client doc 16 Nov (J1 / J8) — a follow-up date (and note) on the lead; Follow-ups lists the due ones.
ALTER TABLE "Lead" ADD COLUMN "nextFollowUpAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "followUpNote" TEXT;
CREATE INDEX "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");
