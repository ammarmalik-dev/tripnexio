-- P07: locked reference format 1 + MM + YY + ServiceCode + MonthlySequence
-- (Locked Business Rules v2.0 §4) and persisted invoice numbers.

-- Service reference codes. VI / FL / RT are the client's own examples;
-- VE / VC / OT are pending client confirmation (Admin can edit them).
ALTER TABLE "Service" ADD COLUMN "referenceCode" TEXT;
UPDATE "Service" SET "referenceCode" = CASE "code"
  WHEN 'NEW_VISA' THEN 'VI'
  WHEN 'FLIGHT_SPECIAL_FARE' THEN 'FL'
  WHEN 'RETURN_TICKET' THEN 'RT'
  WHEN 'VISA_EXTENSION' THEN 'VE'
  WHEN 'VISA_CHANGE' THEN 'VC'
  WHEN 'OTB' THEN 'OT'
  WHEN 'OTHER' THEN 'OS'
  ELSE upper(left("code", 2))
END;
ALTER TABLE "Service" ALTER COLUMN "referenceCode" SET NOT NULL;
CREATE UNIQUE INDEX "Service_referenceCode_key" ON "Service"("referenceCode");

CREATE TABLE "ReferenceCounter" (
    "period" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceCounter_pkey" PRIMARY KEY ("period")
);

CREATE TABLE "InvoiceCounter" (
    "financialYear" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("financialYear")
);

-- Lead.reference becomes unique. Older references were derived from the
-- last 6 characters of the row id, so a repeat is possible in theory; only
-- such a repeat (never the first row) gets "-2", "-3" appended so the
-- unique index can be created. No other existing reference changes.
WITH dupes AS (
  SELECT "id", row_number() OVER (PARTITION BY "reference" ORDER BY "createdAt", "id") AS rn
  FROM "Lead" WHERE "reference" IS NOT NULL
)
UPDATE "Lead" l SET "reference" = l."reference" || '-' || d.rn
FROM dupes d WHERE l."id" = d."id" AND d.rn > 1;
CREATE UNIQUE INDEX "Lead_reference_key" ON "Lead"("reference");

-- Bookings still carrying the random "PENDING-..." placeholder take their
-- lead's reference (the locked "Lead ID becomes Booking ID" rule); a lead
-- with more than one such booking gets "-2", "-3" on the later ones.
-- Real TNX-XX-XXXXXX booking ids are left untouched.
WITH pending AS (
  SELECT b."id", l."reference",
         row_number() OVER (PARTITION BY b."leadId" ORDER BY b."createdAt", b."id") AS rn
  FROM "Booking" b JOIN "Lead" l ON l."id" = b."leadId"
  WHERE b."bookingId" LIKE 'PENDING-%' AND l."reference" IS NOT NULL
),
candidates AS (
  SELECT "id", CASE WHEN rn = 1 THEN "reference" ELSE "reference" || '-' || rn END AS new_id FROM pending
)
UPDATE "Booking" b SET "bookingId" = c.new_id
FROM candidates c
WHERE b."id" = c."id"
  AND NOT EXISTS (SELECT 1 FROM "Booking" other WHERE other."bookingId" = c.new_id);

-- Persisted invoice numbers. Payments that already succeeded keep the number
-- their invoice has always shown (INV- + last 8 characters of the id), so an
-- invoice a customer already has never changes.
ALTER TABLE "Payment" ADD COLUMN "invoiceNumber" TEXT;
UPDATE "Payment" SET "invoiceNumber" = 'INV-' || upper(right("id", 8)) WHERE "status" = 'SUCCESS';
CREATE UNIQUE INDEX "Payment_invoiceNumber_key" ON "Payment"("invoiceNumber");
