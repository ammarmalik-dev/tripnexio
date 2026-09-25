-- Item 11 (client-message/PENDING_WORK_PROMPTS.md): SMS as a third
-- notification channel alongside WHATSAPP/EMAIL. Additive-only, safe
-- (Postgres allows adding an enum value without a data migration).
ALTER TYPE "NotificationChannel" ADD VALUE 'SMS';
