-- Client doc 16 Nov (I7) — a separate "Invoice Edit" permission (admin.full already includes it).
INSERT INTO "Permission" ("id", "name", "description", "createdAt", "updatedAt")
VALUES ('perm_invoices_edit', 'invoices.edit', 'Edit an issued invoice: lines, GST, vendor + vendor cost, actual amount collected and gateway fee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
