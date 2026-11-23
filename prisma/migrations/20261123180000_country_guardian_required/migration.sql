-- Client doc 16 Nov (F2) - per country: parent / guardian details required for a New Visa applicant under 18.
ALTER TABLE "Country" ADD COLUMN "newVisaGuardianRequired" BOOLEAN NOT NULL DEFAULT true;
