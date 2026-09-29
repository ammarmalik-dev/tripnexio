"use client";

import { useState } from "react";
import { Plane, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { POST_TICKET_OFFER_LINKS } from "@/lib/cross-sell/offer-links";

/**
 * P15 — shown after a Special Fare ticket is delivered: Return Verified
 * Ticket and OTB as separate services. "No thanks" stores the opt-out on
 * the lead, so the offer isn't shown again for this journey.
 */
export function PostTicketOfferCard({ bookingToken }: { bookingToken: string }) {
  const [hidden, setHidden] = useState(false);
  const [pending, setPending] = useState(false);
  if (hidden) return null;

  const decline = async () => {
    setPending(true);
    try {
      await postJson(`/api/pay/${bookingToken}/cross-sell-opt-out`, {});
      setHidden(true);
      toast.success("Got it — we won't offer these again for this trip.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save your choice. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="post-ticket-offer-title">
      <h2 id="post-ticket-offer-title" className="text-base font-semibold text-ink-heading">
        Need anything else for this trip?
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plane className="h-4 w-4 text-ink-accent" aria-hidden="true" />
            Return Verified Ticket
          </p>
          <p className="text-xs text-ink-secondary">A verifiable return ticket, if your destination or airline asks for one.</p>
          <ButtonLink href={POST_TICKET_OFFER_LINKS.returnTicket} size="sm" className="self-start">
            Get a Return Ticket
          </ButtonLink>
        </div>
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <ShieldCheck className="h-4 w-4 text-ink-accent" aria-hidden="true" />
            OTB (Ok to Board)
          </p>
          <p className="text-xs text-ink-secondary">If your airline needs an OTB before you fly, we can arrange it.</p>
          <ButtonLink href={POST_TICKET_OFFER_LINKS.otb} size="sm" className="self-start">
            Check OTB
          </ButtonLink>
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => void decline()} isLoading={pending} className="self-start">
        No thanks
      </Button>
    </section>
  );
}
