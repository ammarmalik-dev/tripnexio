-- Step 45 (Admin FINAL handover §19): SystemConfig -- singleton holding
-- non-secret operational settings (company/branding overrides, currency
-- display, timezone offset, data-retention/backup reference values,
-- maintenance-mode banner, system-alert email). See the model's own
-- schema doc comment for exactly which fields have a real wired effect.

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "companyName" TEXT,
    "companyTagline" TEXT,
    "companyAddress" TEXT,
    "companyPhone" TEXT,
    "companyEmail" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "timezoneOffsetMinutes" INTEGER NOT NULL DEFAULT 330,
    "documentRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "auditRetentionDays" INTEGER,
    "backupRetentionDays" INTEGER,
    "backupScheduleNote" TEXT,
    "maintenanceModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "systemAlertEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);
