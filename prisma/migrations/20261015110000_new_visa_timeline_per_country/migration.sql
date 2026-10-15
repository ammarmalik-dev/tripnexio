-- Client doc 2026-10-15 — one New Visa timeline per country. The service-wide New Visa values
-- (ServiceTimelineConfig) are copied into every country that has a New Visa product, only where the
-- country's own value is empty, so nothing that works today changes. Data only, no schema change.
INSERT INTO "NewVisaCountryTimeline" ("id", "countryId", "minTravelDaysNormal", "minTravelDaysExpress", "processingDaysNormal", "processingDaysExpress", "createdAt", "updatedAt")
SELECT 'nvt_' || md5(c."id"), c."id", s."minTravelDaysNormal", s."minTravelDaysExpress", s."processingDaysNormal", s."processingDaysExpress", now(), now()
FROM "Country" c
CROSS JOIN (SELECT * FROM "ServiceTimelineConfig" WHERE "serviceType" = 'NEW_VISA') s
WHERE EXISTS (SELECT 1 FROM "NewVisaCountryConfig" n WHERE n."countryId" = c."id")
ON CONFLICT ("countryId") DO NOTHING;

UPDATE "NewVisaCountryTimeline" t
SET "minTravelDaysNormal" = COALESCE(t."minTravelDaysNormal", s."minTravelDaysNormal"),
    "minTravelDaysExpress" = COALESCE(t."minTravelDaysExpress", s."minTravelDaysExpress"),
    "processingDaysNormal" = COALESCE(t."processingDaysNormal", s."processingDaysNormal"),
    "processingDaysExpress" = COALESCE(t."processingDaysExpress", s."processingDaysExpress"),
    "updatedAt" = now()
FROM (SELECT * FROM "ServiceTimelineConfig" WHERE "serviceType" = 'NEW_VISA') s
WHERE t."minTravelDaysNormal" IS NULL OR t."minTravelDaysExpress" IS NULL OR t."processingDaysNormal" IS NULL OR t."processingDaysExpress" IS NULL;
