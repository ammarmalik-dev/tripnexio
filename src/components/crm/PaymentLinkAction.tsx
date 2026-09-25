"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { CopyPaymentLinkButton } from "./CopyPaymentLinkButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import type { BookingStatus, PaymentStatus } from "../../generated/prisma/enums";

interface PaymentItem {
  status: PaymentStatus;
  paymentLink: string | null;
  linkExpiresAt: string | null;
}

interface BookingPaymentInfo {
  status: BookingStatus;
  customerToken: string | null;
  payments: PaymentItem[];
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Step 57 (Internal Dashboard Merged / audit Tier 3 — "make Payment Link
 * Generation genuinely easy to reach") — the one place that decides what
 * payment-link action a booking needs right now, reused by both the
 * standalone Payment Link screen (after a booking search) and the Manual
 * Lead success panel (which already knows the booking id it just created).
 * Mirrors BookingDetail.tsx's own "Payment Link" button exactly (same
 * POST /api/bookings/[id]/payments call) rather than inventing a second
 * payment-link-creation path.
 */
export function PaymentLinkAction({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [booking, setBooking] = useState<BookingPaymentInfo | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadBooking() {
      setState("loading");
      try {
        const result = await getJson<BookingPaymentInfo>(`/api/bookings/${bookingId}`);
        if (cancelled) return;
        setBooking(result);
        setState("success");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void loadBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingId, reloadNonce]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await postJson(`/api/bookings/${bookingId}/payments`, {});
      toast.success("Payment link created.");
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create a payment link. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (state === "loading") return <Skeleton className="h-9 w-full" />;
  if (state === "error" || !booking) return <p className="text-sm text-error">Couldn&apos;t load this booking&apos;s payment details.</p>;

  const pendingPayment = booking.payments.find((payment) => payment.status === "PENDING" && payment.paymentLink);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {booking.customerToken ? <CopyPaymentLinkButton customerToken={booking.customerToken} /> : null}

      {pendingPayment?.paymentLink ? (
        <>
          <CopyLinkButton url={pendingPayment.paymentLink} label="Copy Gateway Link" />
          {pendingPayment.linkExpiresAt ? (
            <span className="text-xs text-ink-tertiary">Expires {formatExpiry(pendingPayment.linkExpiresAt)}</span>
          ) : null}
        </>
      ) : booking.status === "PENDING" ? (
        <Button type="button" size="sm" onClick={() => void handleGenerate()} isLoading={generating}>
          Generate Payment Link
        </Button>
      ) : !booking.customerToken ? (
        <p className="text-sm text-ink-tertiary">No payment is currently pending on this booking.</p>
      ) : null}
    </div>
  );
}
