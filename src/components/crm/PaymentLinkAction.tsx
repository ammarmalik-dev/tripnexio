"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Send, Repeat } from "lucide-react";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { Button } from "@/components/ui/Button";
import { CopyPaymentLinkButton } from "./CopyPaymentLinkButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import type { BookingStatus, PaymentStatus } from "../../generated/prisma/enums";

interface PaymentItem {
  id: string;
  status: PaymentStatus;
  method: "GATEWAY" | "BANK_TRANSFER";
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
  const [resending, setResending] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  // Client doc 16 Nov (I1) — switch the unpaid payment between an online link and bank transfer (the link is cancelled
  // at the gateway first, so the customer can't pay twice).
  const handleSwitch = async (to: "GATEWAY" | "BANK_TRANSFER") => {
    const reason = await confirm({
      title: to === "BANK_TRANSFER" ? "Switch to bank transfer?" : "Switch to an online payment link?",
      description:
        to === "BANK_TRANSFER"
          ? "The online payment link is cancelled at the gateway and a bank-transfer payment is created — upload the customer's slip on the booking for approval."
          : "The bank-transfer payment is withdrawn and a new online payment link is created and sent to the customer.",
      confirmLabel: "Switch",
    });
    if (!reason) return;
    setSwitching(true);
    try {
      await postJson(`/api/bookings/${bookingId}/payment-method`, { to, reason });
      toast.success(to === "BANK_TRANSFER" ? "Switched to bank transfer." : "Switched to an online payment link.");
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't switch the payment method.");
    } finally {
      setSwitching(false);
    }
  };
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

  // Client doc 16 Nov (I3) — send the pending link to the customer again (email + WhatsApp).
  const handleResend = async (paymentId: string) => {
    setResending(true);
    try {
      await postJson(`/api/payments/${paymentId}/resend-link`, {});
      toast.success("Payment link sent to the customer again.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send the payment link. Please try again.");
    } finally {
      setResending(false);
    }
  };

  if (state === "loading") return <Skeleton className="h-9 w-full" />;
  if (state === "error" || !booking) return <p className="text-sm text-error">Couldn&apos;t load this booking&apos;s payment details.</p>;

  const pendingPayment = booking.payments.find((payment) => payment.status === "PENDING" && payment.paymentLink);
  const unpaid = booking.payments.find((payment) => payment.status === "PENDING");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {booking.customerToken ? <CopyPaymentLinkButton customerToken={booking.customerToken} /> : null}

      {pendingPayment?.paymentLink ? (
        <>
          <CopyLinkButton url={pendingPayment.paymentLink} label="Copy Gateway Link" />
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleResend(pendingPayment.id)} isLoading={resending}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Resend to customer
          </Button>
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
      {unpaid ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleSwitch(unpaid.method === "GATEWAY" ? "BANK_TRANSFER" : "GATEWAY")} isLoading={switching}>
          <Repeat className="h-4 w-4" aria-hidden="true" />
          {unpaid.method === "GATEWAY" ? "Switch to bank transfer" : "Switch to online link"}
        </Button>
      ) : null}
      {dialog}
    </div>
  );
}
