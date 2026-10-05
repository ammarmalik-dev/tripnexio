import { ReceiptText, Info } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { DestinationPriceLookup } from "./DestinationPriceLookup";

export interface ReturnTicketLandingDestination {
  countryName: string;
  ratePerApplicant: number;
  cancellationFee: number | null;
}

/**
 * P19 — RVT Page Content v3 §11 "Cancellation & Refund". The refund rules
 * are locked business rules (fixed copy); the per-destination rate and
 * cancellation fee come from Admin's ReturnTicketDestination rows, shown for
 * the one destination the customer selects (no price table, 2026-10-05). When
 * those can't be read (null) or none are active, only the wording is shown
 * — no amount is ever stated from code.
 */
export function CancellationRefundSection({ destinations }: { destinations: ReturnTicketLandingDestination[] | null }) {
  const rows = destinations ?? [];
  const hasDestinations = rows.length > 0;
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <div className="flex flex-col gap-4">
            <SectionHeading eyebrow="Cancellation" title="Cancellation charges may apply" />
            <p className="text-sm text-ink-secondary sm:text-base">
              Customers can request cancellation according to the configured refund policy. A cancellation fee may be
              deducted from the eligible refund amount.
            </p>
            <GlassCard tier={1} className="flex items-start gap-3 p-5 sm:p-6">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-ink-accent" aria-hidden="true" />
              <p className="text-sm text-ink-secondary">
                Once the request has reached the locked non-refundable stage &mdash; after document validation and
                forwarding to the airline/partner &mdash; the booking is non-refundable. Ticket issuance is also
                non-refundable under the current business rules. Payment gateway charges are non-refundable.
              </p>
            </GlassCard>
          </div>
        </MotionReveal>

        <MotionReveal delay={0.08}>
          <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold text-ink-heading">Price for your destination</h3>
            </div>
            {hasDestinations ? (
              <DestinationPriceLookup destinations={rows} />
            ) : (
              <p className="text-sm text-ink-secondary">
                The applicable price and cancellation fee for your destination are shown clearly before payment.
              </p>
            )}
            {hasDestinations ? (
              <p className="text-xs text-ink-tertiary">
                The applicable cancellation fee and refund rule are shown again in your summary before payment.
              </p>
            ) : null}
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
