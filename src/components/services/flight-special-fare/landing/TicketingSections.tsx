import { Luggage, ReceiptText, TicketCheck, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

/** Doc §12 Baggage + §13 Cancellation & Refund, side by side (doc order kept left→right). */
export function BaggageAndRefundSection() {
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MotionReveal className="h-full">
          <GlassCard tier={2} as="article" className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <Luggage className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-medium tracking-wide text-ink-accent uppercase">Baggage</h2>
            <p className="text-sm text-ink-secondary sm:text-base">
              Baggage allowance is shown with the quoted flight option and is entered according to the applicable
              airline/fare information.
            </p>
          </GlassCard>
        </MotionReveal>
        <MotionReveal delay={0.08} className="h-full">
          <GlassCard tier={2} as="article" className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">Cancellation &amp; refund</span>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-heading">
              Cancellation depends on the applicable fare rules
            </h2>
            <p className="text-sm text-ink-secondary sm:text-base">
              Cancellation and refund eligibility depends on the applicable airline/vendor rules and configured charges.
            </p>
            <div className="flex flex-col gap-1.5 rounded-md border border-hairline bg-surface-1 px-4 py-3">
              <span className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">
                Configured refund calculation:
              </span>
              <p className="text-sm font-medium text-ink-heading">
                Paid Amount − Vendor/Airline Cancellation Charge − Gateway Charge
              </p>
            </div>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}

// Locked content — doc §14 "When your ticket is issued".
const ticketContents = [
  "Ticket number",
  "PNR / vendor reference",
  "Ticket issue time",
  "Passenger details",
  "Airline",
  "Flight",
  "Baggage",
  "Ticket PDF",
];

/** Doc §14 — what an issued ticket includes and how it's delivered. */
export function TicketDeliverySection() {
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <div className="flex flex-col gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <TicketCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              eyebrow="Ticket delivery"
              title="When your ticket is issued"
              description="The ticket is delivered through WhatsApp, email and any configured customer channel."
            />
          </div>
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <GlassCard tier={2} className="p-6 sm:p-8">
            <h3 className="mb-4 text-base font-semibold text-ink-heading">
              After final confirmation, the issued ticket can include:
            </h3>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ticketContents.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
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
