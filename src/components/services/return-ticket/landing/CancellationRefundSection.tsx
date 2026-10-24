import { ReceiptText, Info } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";
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
 * — no amount is ever stated from code. The wording is editable in Admin → Website Pages (client confirmation
 * 2026-10-25); the amounts stay Admin config.
 */
export function CancellationRefundSection({
  destinations,
  content,
}: {
  destinations: ReturnTicketLandingDestination[] | null;
  content: SitePageContentView;
}) {
  const rows = destinations ?? [];
  const hasDestinations = rows.length > 0;
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <div className="flex flex-col gap-4">
            <SectionHeading eyebrow={content.text("cancellation.eyebrow")} title={content.text("cancellation.title")} />
            <p className="text-sm text-ink-secondary sm:text-base">{content.text("cancellation.intro")}</p>
            <GlassCard tier={1} className="flex items-start gap-3 p-5 sm:p-6">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-ink-accent" aria-hidden="true" />
              <p className="text-sm text-ink-secondary">{content.text("cancellation.note")}</p>
            </GlassCard>
          </div>
        </MotionReveal>

        <MotionReveal delay={0.08}>
          <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold text-ink-heading">{content.text("cancellation.priceTitle")}</h3>
            </div>
            {hasDestinations ? (
              <DestinationPriceLookup
                destinations={rows}
                labels={{
                  select: content.text("cancellation.selectLabel"),
                  placeholder: content.text("cancellation.selectPlaceholder"),
                  prompt: content.text("cancellation.selectPrompt"),
                  price: content.text("cancellation.priceLabel"),
                  fee: content.text("cancellation.feeLabel"),
                  noFee: content.text("cancellation.noFeeLabel"),
                }}
              />
            ) : (
              <p className="text-sm text-ink-secondary">{content.text("cancellation.noPricesText")}</p>
            )}
            {hasDestinations ? <p className="text-xs text-ink-tertiary">{content.text("cancellation.priceNote")}</p> : null}
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
