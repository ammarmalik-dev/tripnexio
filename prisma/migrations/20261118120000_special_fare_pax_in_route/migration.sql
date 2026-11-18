-- Client doc 16 Nov (A8): customer flight notifications show the passenger count with the route.
-- Only Special Fare templates that still carry the original route phrase and no passenger count are changed,
-- so a template Admin has reworded is left alone. Origin / destination already render as city names in code.
UPDATE "NotificationTemplate"
SET "body" = replace("body", '{{origin}} → {{destination}}', '{{origin}} → {{destination}} ({{passenger_count}} PAX)'),
    "updatedAt" = NOW()
WHERE "event" LIKE 'SF\_%'
  AND strpos("body", '{{origin}} → {{destination}}') > 0
  AND strpos("body", 'passenger_count') = 0;

UPDATE "NotificationTemplate"
SET "body" = replace("body", '{{requested_origin}} → {{requested_destination}}', '{{requested_origin}} → {{requested_destination}} ({{passenger_count}} PAX)'),
    "updatedAt" = NOW()
WHERE "event" LIKE 'SF\_%'
  AND strpos("body", '{{requested_origin}} → {{requested_destination}}') > 0
  AND strpos("body", 'passenger_count') = 0;
