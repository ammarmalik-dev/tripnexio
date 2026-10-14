-- Client doc 2026-10-15: GST is registered. Details from the client's GST
-- registration certificate (REG-06) and Udyam certificate: legal name AZHAR
-- RAHMAN, trade name TRIPNEXIO, proprietorship, GSTIN 09ALTPR2177H1ZE (Uttar
-- Pradesh). They're filled in only where Admin hasn't set a value yet, so an
-- existing entry is never overwritten. The GST rate itself is not changed here —
-- Admin sets it in Tax & Fees.
UPDATE "SystemConfig"
SET "legalEntityName" = 'Azhar Rahman (Proprietor), trade name TripNexio', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'singleton' AND ("legalEntityName" IS NULL OR btrim("legalEntityName") = '');

UPDATE "SystemConfig"
SET "gstin" = '09ALTPR2177H1ZE', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'singleton' AND ("gstin" IS NULL OR btrim("gstin") = '');

UPDATE "InvoiceConfig"
SET "companyGstNumber" = '09ALTPR2177H1ZE', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'singleton' AND ("companyGstNumber" IS NULL OR btrim("companyGstNumber") = '');
