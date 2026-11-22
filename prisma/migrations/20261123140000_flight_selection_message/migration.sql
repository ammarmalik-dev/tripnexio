-- Client doc 16 Nov (A10): the Special Fare "quotation selected" message names the selected flight
-- (airline, flight no., cities, dates, times, PAX) with the client's subject / heading / wording. Only templates
-- still carrying the original text are changed, so an Admin-edited template is left alone.
UPDATE "NotificationTemplate"
SET "subject" = 'Your Flight Selection Has Been Received — {{booking_id}}',
    "heading" = 'Flight Option Selected Successfully',
    "body" = 'Hi {{customer_name}},

Thank you for selecting your preferred flight. Our team will review your selection and proceed with the booking.

Selected flight: {{itinerary_summary}}
Airline / flight no.: {{airline_flight_number}}
Passengers: {{passenger_count}} PAX
Total: {{currency}} {{quoted_amount}}

Please complete payment before {{quote_expiry_time}}.',
    "updatedAt" = NOW()
WHERE "event" = 'SF_03' AND "channel" = 'EMAIL' AND "body" = 'Hi {{customer_name}},

Your quotation {{booking_id}} is approved. Total: {{currency}} {{quoted_amount}}. Please complete payment before {{quote_expiry_time}}.';

UPDATE "NotificationTemplate"
SET "body" = 'Hi {{customer_name}},

Flight option selected successfully — thank you. Our team will review your selection and proceed with the booking.

Selected flight: {{itinerary_summary}}
Airline / flight no.: {{airline_flight_number}}
Passengers: {{passenger_count}} PAX
Total: {{currency}} {{quoted_amount}}
Please complete payment before {{quote_expiry_time}}.',
    "updatedAt" = NOW()
WHERE "event" = 'SF_03' AND "channel" = 'WHATSAPP' AND "body" = 'Hi {{customer_name}},

Your quotation {{booking_id}} is approved. Total: {{currency}} {{quoted_amount}}. Please complete payment before {{quote_expiry_time}}.';

-- Customers read "Quotation Selected" (Special Fare) and "Package Selected" (Visa Change); the internal name stays.
UPDATE "ServiceStatus"
SET "customerLabel" = 'Quotation Selected', "updatedAt" = NOW()
WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "name" = 'Quotation Accepted' AND "customerLabel" = 'Quotation Accepted';

UPDATE "ServiceStatus"
SET "customerLabel" = 'Package Selected', "updatedAt" = NOW()
WHERE "serviceType" = 'VISA_CHANGE' AND "name" = 'Quotation Accepted' AND "customerLabel" = 'Quotation Accepted';
