-- Client reply 2026-10-13: OTB is priced only per country x airline, with one rate
-- for every passenger. The airline-level OTB price (Airline.normalPrice/urgentPrice)
-- is no longer read. To keep today's live prices working, copy each OTB airline's
-- own price into an ADULT OtbPrice row for every active country that has none yet.
-- Data-only: nothing is deleted or changed, Airline columns are kept, and an
-- existing OtbPrice row is never overwritten (ON CONFLICT DO NOTHING).
INSERT INTO "OtbPrice" ("id", "airlineId", "countryId", "paxType", "normalPrice", "urgentPrice", "airlineFee", "active", "createdAt", "updatedAt")
SELECT
  'otbp_' || substr(md5(random()::text || clock_timestamp()::text || a."id" || c."id"), 1, 24),
  a."id",
  c."id",
  'ADULT',
  a."normalPrice",
  a."urgentPrice",
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Airline" a
CROSS JOIN "Country" c
WHERE a."otbRequired" = true
  AND a."active" = true
  AND a."normalPrice" IS NOT NULL
  AND c."active" = true
  AND NOT EXISTS (SELECT 1 FROM "OtbPrice" p WHERE p."airlineId" = a."id" AND p."countryId" = c."id")
ON CONFLICT ("airlineId", "countryId", "paxType") DO NOTHING;
