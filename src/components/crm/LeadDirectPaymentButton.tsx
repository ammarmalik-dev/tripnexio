"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { CopyLinkButton } from "./CopyLinkButton";

type PriceState = { available: true; totalPrice: number } | { available: false; reason: string } | null;

/**
 * Client corrections 2026-10-05 §7/§16 — New Visa / OTB / Return Ticket:
 * "Create Payment Link" straight from the lead at the Admin-configured price
 * (no quotation). Shows the amount first; when the price isn't configured it
 * says what's missing instead of offering the button.
 */
export function LeadDirectPaymentButton({ leadId, onCreated }: { leadId: string; onCreated: () => void }) {
  const [price, setPrice] = useState<PriceState>(null);
  const [creating, setCreating] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmAction();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<PriceState>(`/api/leads/${leadId}/payment-link`);
        if (!cancelled) setPrice(result);
      } catch {
        if (!cancelled) setPrice({ available: false, reason: "Couldn't check the configured price." });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (payUrl) return <CopyLinkButton url={payUrl} label="Copy Payment Link" />;
  if (!price) return null;
  if (!price.available) {
    return <p className="max-w-xs text-xs text-warning">Direct payment link unavailable: {price.reason}</p>;
  }

  const amount = `₹${price.totalPrice.toLocaleString("en-IN")}`;
  const create = async () => {
    const reason = await confirm({
      title: `Create a payment link for ${amount}?`,
      description: "A booking is created with the lead's reference and the customer gets a payment link at the Admin-configured price. It becomes an active booking only after the payment succeeds.",
      confirmLabel: "Create Payment Link",
    });
    if (!reason) return;
    setCreating(true);
    try {
      const result = await postJson<{ payUrl: string }>(`/api/leads/${leadId}/payment-link`, { reason });
      setPayUrl(result.payUrl);
      toast.success("Payment link created — copy it and share it with the customer.");
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create the payment link. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Button type="button" size="sm" onClick={() => void create()} isLoading={creating}>
        <Link2 className="h-4 w-4" aria-hidden="true" />
        Create Payment Link · {amount}
      </Button>
      {dialog}
    </>
  );
}
