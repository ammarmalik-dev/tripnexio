-- Step 9 (client-locked-spec DEVELOPMENT_ROADMAP.md): Flight_Special_Fare.md
-- §7/§12 locks Adult(12+)/Child(2-11)/Infant(<2) passenger typing computed
-- from DOB on travel date. Quotation.infantFare already existed as a quote
-- field with no PaxType value to ever record an actual infant passenger
-- (AUDIT_REPORT.md §2.4, CONFLICTING). Adds INFANT to the existing enum.
ALTER TYPE "PaxType" ADD VALUE 'INFANT';
