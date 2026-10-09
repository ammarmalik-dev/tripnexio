-- Client testing 2026-10-09 (F3) — airlines saved before the logo lookup existed
-- have no logo: fill it from the IATA code, the same source new airlines use
-- (src/lib/airlines/fetch-logo.ts). Logos Admin set by hand are untouched.
UPDATE "Airline"
SET "logoUrl" = 'https://images.kiwi.com/airlines/64/' || UPPER(TRIM("code")) || '.png'
WHERE ("logoUrl" IS NULL OR TRIM("logoUrl") = '') AND TRIM("code") <> '';
