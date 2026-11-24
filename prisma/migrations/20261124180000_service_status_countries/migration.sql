-- Client doc 16 Nov (G1): statuses per Service x Country (empty = every country).
ALTER TABLE "ServiceStatus" ADD COLUMN "countryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
