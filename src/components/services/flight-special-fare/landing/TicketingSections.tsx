import { Luggage, ReceiptText, TicketCheck, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

interface ContentProps {
  content: SitePageContentView;
}

/** Doc §12 Baggage + §13 Cancellation & Refund, side by side (doc order kept left→right). */
export function BaggageAndRefundSection({ content }: ContentProps) {
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MotionReveal className="h-full">
          <GlassCard tier={2} as="article" className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <Luggage className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-medium tracking-wide text-ink-accent uppercase">{content.text("baggageRefund.baggageTitle")}</h2>
            <p className="text-sm text-ink-secondary sm:text-base">{content.text("baggageRefund.baggageText")}</p>
          </GlassCard>
        </MotionReveal>
        <MotionReveal delay={0.08} className="h-full">
          <GlassCard tier={2} as="article" className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">{content.text("baggageRefund.refundEyebrow")}</span>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-heading">{content.text("baggageRefund.refundTitle")}</h2>
            <p className="text-sm text-ink-secondary sm:text-base">{content.text("baggageRefund.refundText")}</p>
            <div className="flex flex-col gap-1.5 rounded-md border border-hairline bg-surface-1 px-4 py-3">
              <span className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">
                {content.text("baggageRefund.formulaLabel")}
              </span>
              <p className="text-sm font-medium text-ink-heading">{content.text("baggageRefund.formula")}</p>
            </div>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}

/**
 * Doc §14 — what an issued ticket includes and how it's delivered. Client doc 2026-10-20: the default list
 * ("ticketDelivery.items", Admin → Website Pages) is PNR only (no ticket number / partner reference / issue time).
 */
export function TicketDeliverySection({ content }: ContentProps) {
  const ticketContents = content.list("ticketDelivery.items").map((row) => row.join(" | "));
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <div className="flex flex-col gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <TicketCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              eyebrow={content.text("ticketDelivery.eyebrow")}
              title={content.text("ticketDelivery.title")}
              description={content.text("ticketDelivery.intro")}
            />
          </div>
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <GlassCard tier={2} className="p-6 sm:p-8">
            <h3 className="mb-4 text-base font-semibold text-ink-heading">{content.text("ticketDelivery.cardTitle")}</h3>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ticketContents.map((item, index) => (
                <li key={`${index}-${item}`} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
