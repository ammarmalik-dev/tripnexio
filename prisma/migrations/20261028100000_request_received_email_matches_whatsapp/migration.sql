-- Client 2026-10-28 ("submit confirmation whatsapp, mail, website screen tino alag alag he") — the request-received
-- EMAIL of each service's "New" status now carries the same wording as its WhatsApp body (the Meta-submitted copy,
-- also shown on the website success screen). Data only; subject / heading / button unchanged. A row is updated only
-- while it still holds the original catalog copy, so an Admin-edited email is never overwritten.
UPDATE "NotificationTemplate" SET "body" = $tn_new$Hi {{customer_name}},

Thanks for choosing TripNexio!

Your New Visa {{country_name}} request has been received. Please complete your payment to proceed.

Application ID: {{application_id}}
Country: {{country_name}}

If you have already paid, please disregard this message.$tn_new$, "updatedAt" = now()
WHERE "event" = 'NV_COUNTRY_REQUEST_PAYMENT_PENDING' AND "channel" = 'EMAIL' AND "body" = $tn_old$Hi {{customer_name}},

Thanks for choosing TripNexio!

We've received your New Visa request for {{country_name}}, but your payment is still pending. Please complete your payment to proceed with the application.

Application ID: {{application_id}}
Country: {{country_name}}

If you have already paid, please disregard this message.$tn_old$;

UPDATE "NotificationTemplate" SET "body" = $tn_new$We've received your Visa Extension request. Reference: {{lead_id}}.$tn_new$, "updatedAt" = now()
WHERE "event" = 'EXT_01' AND "channel" = 'EMAIL' AND "body" = $tn_old$Hi {{customer_name}},

We've received your Visa Extension request. Reference: {{lead_id}}.$tn_old$;

UPDATE "NotificationTemplate" SET "body" = $tn_new$Hi {{customer_name}},

Thanks for choosing TripNexio! We've received your Visa Change request. Application ID: {{application_id}}. Our team will review it and update you when your quotation is ready.$tn_new$, "updatedAt" = now()
WHERE "event" = 'VC_NEW' AND "channel" = 'EMAIL' AND "body" = $tn_old$Hi {{customer_name}},

Thanks for choosing TripNexio!

We've received your Visa Change request and our team will review it.

Application ID: {{application_id}}
Passenger(s): {{passenger_names}}
Visa Change method: {{visa_change_method}}

We'll update you when your quotation is ready.$tn_old$;

UPDATE "NotificationTemplate" SET "body" = $tn_new$Your Return Verified Ticket request {{booking_id}} has been received. We'll review the details and update you on the next step.$tn_new$, "updatedAt" = now()
WHERE "event" = 'RVT_NEW' AND "channel" = 'EMAIL' AND "body" = $tn_old$Dear {{customer_name}},

We have received your Return Verified Ticket request.
Request ID: {{booking_id}}
Passenger(s): {{passenger_names}}
Destination: {{country_name}}
Travel date: {{travel_date}}

Please complete your payment using the Pay Now button below so we can arrange your ticket.$tn_old$;

UPDATE "NotificationTemplate" SET "body" = $tn_new$We've received your OK to Board (OTB) request. Booking reference: {{booking_id}}. We'll update you as your request progresses.$tn_new$, "updatedAt" = now()
WHERE "event" = 'OTB_01_NEW' AND "channel" = 'EMAIL' AND "body" = $tn_old$Hi {{customer_name}},

We've received your OK to Board (OTB) request.
Booking reference: {{booking_id}}
Passenger(s): {{passenger_names}}
Destination: {{country_name}}
Travel date: {{travel_date}}

Please complete your payment using the Pay Now button below so we can start processing. Receipt of a request does not guarantee airline approval.$tn_old$;
