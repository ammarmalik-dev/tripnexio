-- Step 6.2 (client-locked-spec DEVELOPMENT_ROADMAP.md): Service as an
-- Admin-editable metadata layer over the 6 locked services -- name,
-- description, icon, display order, and on/off become editable with zero
-- code deployments. Does NOT replace the ServiceType enum, which stays the
-- business-logic type. Seeds the real 6 locked services (not sample data --
-- the actual scope from CLAUDE.md), matching ServiceType's exact string
-- values as `code`.

CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");
CREATE INDEX "Service_active_idx" ON "Service"("active");

INSERT INTO "Service" ("id", "code", "name", "shortDescription", "iconName", "active", "displayOrder", "createdAt", "updatedAt") VALUES
  ('svc_new_visa',       'NEW_VISA',            'New Visa',                'Apply for a new UAE or GCC visa with our simple, guided process.',                      'FileText',       true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_visa_extension', 'VISA_EXTENSION',      'Visa Extension',          'Extend an existing visa originally issued through TripNexio.',                          'CalendarClock',  true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_visa_change',    'VISA_CHANGE',         'Visa Change',             'Change or exit your visa status - airport-to-airport or border exit.',                  'ArrowLeftRight', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_flight_special', 'FLIGHT_SPECIAL_FARE', 'Special Fare Flight',     'Official special fare flight bookings through our airline and vendor partners.',       'Plane',          true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_return_ticket',  'RETURN_TICKET',       'Return Verified Ticket',  'A verified return ticket for use with your visa application.',                          'TicketCheck',    true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_otb',            'OTB',                 'OTB - Ok to Board',       'Airline Ok-to-Board authorization arranged for your departure.',                        'PlaneTakeoff',   true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
