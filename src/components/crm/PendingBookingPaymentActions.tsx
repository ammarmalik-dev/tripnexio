"use client";

import { useState } from "react";
import { Link2, Landmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { postJson, ApiError } from "@/lib/api/client";

/**
 * Client doc 2026-10-27 (K1) — "Manual lead: no payment link / manual payment option". A Manual Lead with a
 * configured price gets its PENDING booking straight away (payment deferred), which hid the lead's own payment-link
 * button and left the options only on the Booking page. The same two actions, right on the lead: a gateway payment
 * link, and Bank Transfer for staff-created leads (the server re-checks both).
 */
export function PendingBookingPaymentActions({
  bookingId,
  offlinePaymentAllowed,
  onCreated,
}: {
  bookingId: string;
  offlinePaymentAllowed: boolean;
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState<"gateway" | "bank-transfer" | null>(null);

  const create = async (method: "gateway" | "bank-transfer") => {
    setBusy(method);
    try {
      await postJson(method === "gateway" ? `/api/bookings/${bookingId}/payments` : `/api/bookings/${bookingId}/bank-transfer-payment`, {});
      toast.success(method === "gateway" ? "Payment link created and sent to the customer." : "Bank-transfer payment created — upload the slip on the booking for approval.");
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create the payment. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => void create("gateway")} isLoading={busy === "gateway"} disabled={busy !== null}>
        <Link2 className="h-4 w-4" aria-hidden="true" />
        Create Payment Link
      </Button>
      {offlinePaymentAllowed ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => void create("bank-transfer")} isLoading={busy === "bank-transfer"} disabled={busy !== null}>
          <Landmark className="h-4 w-4" aria-hidden="true" />
          Bank Transfer (manual payment)
        </Button>
      ) : null}
    </div>
  );
}
