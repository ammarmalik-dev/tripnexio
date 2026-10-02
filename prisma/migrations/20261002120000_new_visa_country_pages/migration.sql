-- AlterTable
ALTER TABLE "Faq" ADD COLUMN     "countryId" TEXT;

-- CreateTable
CREATE TABLE "NewVisaCountryPage" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "cardTagline" TEXT,
    "cardImageFileId" TEXT,
    "heroImageFileId" TEXT,
    "heroEyebrow" TEXT,
    "heroTitle" TEXT NOT NULL,
    "heroSubtitle" TEXT NOT NULL,
    "introHeading" TEXT,
    "introBody" TEXT,
    "applicantsHeading" TEXT,
    "applicantsBody" TEXT,
    "whatYouNeed" TEXT[],
    "documents" TEXT[],
    "documentsNote" TEXT,
    "childrenNote" TEXT,
    "validityText" TEXT,
    "stayText" TEXT,
    "beforeYouApply" TEXT[],
    "ctaHeading" TEXT,
    "ctaBody" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewVisaCountryPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewVisaCountryPage_countryId_key" ON "NewVisaCountryPage"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "NewVisaCountryPage_slug_key" ON "NewVisaCountryPage"("slug");

-- CreateIndex
CREATE INDEX "NewVisaCountryPage_published_idx" ON "NewVisaCountryPage"("published");

-- CreateIndex
CREATE INDEX "Faq_countryId_idx" ON "Faq"("countryId");

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewVisaCountryPage" ADD CONSTRAINT "NewVisaCountryPage_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Data: UAE keeps the exact locked copy it has today (UAE Visa Page Content
-- FINAL), now stored as its country page. Idempotent; skipped when the UAE
-- country row (code ARE) doesn't exist.
INSERT INTO "NewVisaCountryPage" (
  "id", "countryId", "slug", "published", "displayOrder", "cardTagline",
  "heroEyebrow", "heroTitle", "heroSubtitle",
  "introHeading", "introBody",
  "applicantsHeading", "applicantsBody",
  "whatYouNeed", "documents", "documentsNote", "childrenNote",
  "validityText", "stayText", "beforeYouApply",
  "ctaHeading", "ctaBody", "seoTitle", "seoDescription", "updatedAt"
)
SELECT
  'nvpage_uae', c."id", 'uae', true, 0, 'Tourist visas for the UAE, applied online',
  'UAE Visa', 'UAE Visa Made Simple',
  $t$UAE visa, made simple. Apply online, choose your visa option, and let TripNexio guide you from application to completion.$t$,
  'Your UAE visa application, guided end to end',
  $t$Applying for a UAE visa involves choosing the right visa option, sharing accurate traveller details and completing the required documents. TripNexio keeps the process simple, coordinates the next steps with the relevant processing partner or authority, and helps you track your application along the way.$t$,
  'UAE Visa Applications From Across India',
  $t$From every Indian state to different applicant profiles, TripNexio provides a simple way to apply for your UAE visa online.$t$,
  ARRAY[
    'Applicant name, mobile number and email address',
    'Traveller basic details',
    'Occupation / profile information',
    'Expected travel date',
    'Selected visa option, visa type and processing preference'
  ],
  ARRAY['Passport Front Page', 'Passport Last Page', 'Passport Photograph'],
  $t$Additional documents may be requested depending on the application, traveller profile or authority requirements.$t$,
  $t$Applicants under 18 years must apply with at least one parent in the same booking. The child must be linked to that parent. Adult and Child pricing can be configured separately.$t$,
  $t$The period within which you must enter the UAE according to the issued visa.$t$,
  $t$The permitted period you may remain in the UAE according to the issued visa conditions.$t$,
  ARRAY[
    'Provide accurate applicant and traveller information.',
    'Upload clear, genuine and readable documents when requested.',
    'Make sure the selected visa option matches the intended trip.',
    'Processing time does not guarantee visa approval or a fixed authority decision.',
    'Final visa decisions and immigration permissions are determined by the relevant UAE authority.'
  ],
  'Ready to apply for your UAE visa?',
  $t$Choose your visa option, enter your traveller details and complete your application online.$t$,
  'UAE Visa',
  $t$UAE visa, made simple. Apply online, choose your visa option, and let TripNexio guide you from application to completion.$t$,
  CURRENT_TIMESTAMP
FROM "Country" c
WHERE c."code" = 'ARE'
  AND NOT EXISTS (SELECT 1 FROM "NewVisaCountryPage" p WHERE p."countryId" = c."id" OR p."slug" = 'uae');

-- Every New Visa FAQ so far came from the UAE page's FAQ document: tie them to the UAE.
UPDATE "Faq" SET "countryId" = c."id"
FROM "Country" c
WHERE c."code" = 'ARE' AND "Faq"."serviceType" = 'NEW_VISA' AND "Faq"."countryId" IS NULL;