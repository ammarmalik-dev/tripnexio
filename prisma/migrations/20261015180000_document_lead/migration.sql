-- Client doc 2026-10-15 (I6 / C7) — each document belongs to one lead.
ALTER TABLE "Document" ADD COLUMN "leadId" TEXT;
CREATE INDEX "Document_leadId_idx" ON "Document"("leadId");
ALTER TABLE "Document" ADD CONSTRAINT "Document_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Booking documents: the booking's lead.
UPDATE "Document" d SET "leadId" = b."leadId" FROM "Booking" b WHERE d."bookingId" = b."id";

-- Lead-stage documents: the passenger's latest lead created before the upload (+5 minutes for the intake itself).
UPDATE "Document" d SET "leadId" = (
  SELECT l."id" FROM "Lead" l
  WHERE jsonb_typeof(l."details"->'passengerIds') = 'array'
    AND l."details"->'passengerIds' ? d."passengerId"
    AND l."createdAt" <= d."createdAt" + INTERVAL '5 minutes'
  ORDER BY l."createdAt" DESC
  LIMIT 1
)
WHERE d."leadId" IS NULL AND d."bookingId" IS NULL AND d."passengerId" IS NOT NULL;
