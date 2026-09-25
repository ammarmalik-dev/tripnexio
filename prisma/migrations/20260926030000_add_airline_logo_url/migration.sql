-- Item 12 (client-message/PENDING_WORK_PROMPTS.md): airline logo, nullable
-- (auto-populated on create/edit from a free logos-by-IATA-code source,
-- or Admin-overridden directly).
ALTER TABLE "Airline" ADD COLUMN "logoUrl" TEXT;
