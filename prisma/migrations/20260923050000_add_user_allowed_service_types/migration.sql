-- Step 39 (Admin FINAL handover §1): per-user service scoping. Empty array
-- (the default) means unrestricted -- every existing user keeps full
-- access with zero migration risk; see User.allowedServiceTypes' own
-- schema doc comment for the full design rationale (per-user, not
-- per-Role; native array column, not a join table).

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowedServiceTypes" "ServiceType"[] DEFAULT ARRAY[]::"ServiceType"[];
