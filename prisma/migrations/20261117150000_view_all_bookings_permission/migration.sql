-- Client doc 16 Nov (J6) — "View All Bookings": see every lead / quotation / booking, act only on one's own.
INSERT INTO "Permission" ("id", "name", "description", "createdAt", "updatedAt")
VALUES ('perm_bookings_view_all', 'bookings.viewAll', 'View every lead, quotation and booking (actions stay limited to the staff member''s own)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
