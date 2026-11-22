-- Client doc 16 Nov (F8): per-country switch to show the New Visa validity (off by default).
ALTER TABLE "Country" ADD COLUMN "showVisaValidity" BOOLEAN NOT NULL DEFAULT false;
