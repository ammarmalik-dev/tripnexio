-- Client doc 2026-10-15 (C3) — a country (flag + short code) on every lead. Only fills leads that have none.

-- Visa Extension / Visa Change are UAE visas.
UPDATE "Lead" SET "countryId" = (
  SELECT c."id" FROM "Country" c
  WHERE upper(c."code") IN ('ARE', 'AE', 'UAE') OR lower(c."name") = 'united arab emirates'
  ORDER BY c."createdAt" LIMIT 1
)
WHERE "countryId" IS NULL AND "serviceType" IN ('VISA_EXTENSION', 'VISA_CHANGE');

-- Leads whose details name the destination country by code, id or name.
UPDATE "Lead" l SET "countryId" = c."id"
FROM "Country" c
WHERE l."countryId" IS NULL
  AND (
    upper(l."details"->>'destinationCountry') = upper(c."code")
    OR l."details"->>'destinationCountryId' = c."id"
    OR lower(l."details"->>'destinationCountry') = lower(c."name")
  );

-- Special Fare flights: the destination airport's country (by IATA code, city or airport name).
UPDATE "Lead" l SET "countryId" = a."countryId"
FROM "Airport" a
WHERE l."countryId" IS NULL
  AND l."serviceType" = 'FLIGHT_SPECIAL_FARE'
  AND (
    upper(trim(l."details"->>'destination')) = upper(a."code")
    OR lower(trim(l."details"->>'destination')) = lower(a."city")
    OR lower(trim(l."details"->>'destination')) = lower(a."name")
  );
