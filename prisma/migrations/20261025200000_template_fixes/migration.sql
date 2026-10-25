-- Client 2026-10-23 audit, data only (rows Admin already changed are left alone):
-- 1. OTB / Return Ticket "request received" (OTB_01_NEW / RVT_NEW): Pay Now button + trip summary (client 14/15 Oct).
-- 2. VC_VISA_APPROVED email said "instructions are in your email" (WhatsApp wording).

UPDATE "NotificationTemplate" SET "ctaLabel" = 'Pay Now', "ctaLink" = 'payment_link', "updatedAt" = now()
WHERE "event" IN ('OTB_01_NEW', 'RVT_NEW') AND ("ctaLabel" IS NULL OR "ctaLabel" = 'Track Status') AND ("ctaLink" IS NULL OR "ctaLink" = 'secure_link');

UPDATE "NotificationTemplate" SET "body" = 'Hi {{customer_name}},

We''ve received your OK to Board (OTB) request.
Booking reference: {{booking_id}}
Passenger(s): {{passenger_names}}
Destination: {{country_name}}
Travel date: {{travel_date}}

Please complete your payment using the Pay Now button below so we can start processing. Receipt of a request does not guarantee airline approval.', "updatedAt" = now()
WHERE "event" = 'OTB_01_NEW' AND "channel" = 'EMAIL' AND "body" LIKE '%We''ll notify you when there is an update. Receipt of a request does not guarantee airline approval.%';

UPDATE "NotificationTemplate" SET "body" = 'Dear {{customer_name}},

We have received your Return Verified Ticket request.
Request ID: {{booking_id}}
Passenger(s): {{passenger_names}}
Destination: {{country_name}}
Travel date: {{travel_date}}

Please complete your payment using the Pay Now button below so we can arrange your ticket.', "updatedAt" = now()
WHERE "event" = 'RVT_NEW' AND "channel" = 'EMAIL' AND "body" LIKE '%You can check the current status using the button below.%';

UPDATE "NotificationTemplate" SET "body" = replace("body", 'Full travel instructions and disclaimer are in your email.', 'Full travel instructions and disclaimer are below.'), "updatedAt" = now()
WHERE "event" = 'VC_VISA_APPROVED' AND "channel" = 'EMAIL' AND "body" LIKE '%Full travel instructions and disclaimer are in your email.%';
