-- Step 51 (Internal Dashboard Merged §8) — the Manual Lead form's Service
-- dropdown needs an "Other" option. Postgres requires ADD VALUE to commit
-- in its own transaction before the new value can be used anywhere else
-- (same two-migration pattern as Step 49's LeadStatus change).
ALTER TYPE "ServiceType" ADD VALUE 'OTHER';
