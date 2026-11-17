-- Client doc 16 Nov (I11) — coupon tracking: who created each coupon.
ALTER TABLE "Coupon" ADD COLUMN "createdByUserId" TEXT;
