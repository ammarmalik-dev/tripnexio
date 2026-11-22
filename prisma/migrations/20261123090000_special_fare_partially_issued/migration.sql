-- Client doc 16 Nov (A5): Special Fare booking status "Partially Issued" — some passengers' tickets are issued, not all.
-- It sits between "Sent to Airlines" and "Ticket Issued" (later steps move one place down so the order stays
-- forward-only), can go everywhere "Sent to Airlines" can, and moves on to "Ticket Issued" once every ticket is out.
-- Idempotent: nothing changes when the status already exists.

DO $$
DECLARE
  sent_id TEXT;
  sent_order INT;
BEGIN
  IF EXISTS (SELECT 1 FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Partially Issued') THEN
    RETURN;
  END IF;
  SELECT "id", "displayOrder" INTO sent_id, sent_order
  FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Sent to Airlines' AND "active" = true;
  IF sent_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "ServiceStatus" SET "displayOrder" = "displayOrder" + 1, "updatedAt" = now()
  WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "displayOrder" > sent_order;

  INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "notificationEvent", "systemEvent", "active", "createdAt", "updatedAt")
  VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE/BOOKING/Partially Issued'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Partially Issued', sent_order + 1, false, true, 'Partially Issued', NULL, 'PROCESSING', NULL, 'FSF_PARTIALLY_ISSUED', true, now(), now());

  -- Sent to Airlines -> Partially Issued, and Partially Issued -> wherever Sent to Airlines may go.
  INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
  VALUES ('sst_' || md5(sent_id || '>' || 'ss_' || md5('FLIGHT_SPECIAL_FARE/BOOKING/Partially Issued')), sent_id, 'ss_' || md5('FLIGHT_SPECIAL_FARE/BOOKING/Partially Issued'))
  ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

  INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
  SELECT 'sst_' || md5('ss_' || md5('FLIGHT_SPECIAL_FARE/BOOKING/Partially Issued') || '>' || t."toStatusId"), 'ss_' || md5('FLIGHT_SPECIAL_FARE/BOOKING/Partially Issued'), t."toStatusId"
  FROM "ServiceStatusTransition" t
  WHERE t."fromStatusId" = sent_id AND t."toStatusId" <> 'ss_' || md5('FLIGHT_SPECIAL_FARE/BOOKING/Partially Issued')
  ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
END $$;
