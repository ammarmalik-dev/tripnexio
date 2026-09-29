import { CheckCircle2, Timer, CircleAlert, BellRing } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MotionReveal } from "@/components/motion/MotionReveal";

const REQUEST_HREF = "/services/flight-special-fare/request";

// Locked content — doc §8. "Vendor reference (internal only)" is deliberately
// left out of this customer-facing list: the doc itself marks it internal.
const quoteOptionDetails = [
  "Airline",
  "Flight number",
  "Departure / arrival",
  "Travel date",
  "Departure / arrival time",
  "Baggage",
  "Fare",
  "Quote validity",
  "Booking deadline (where applicable)",
];

/** Doc §8 — more than one flight option may be sent for the same request. */
export function MultipleOptionsSection() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <MotionReveal>
          <SectionHeading
            eyebrow="Compare available options"
            title="More than one option may be available"
            description="Depending on availability, TripNexio may send multiple flight options for the same request. Options can differ by airline, flight timing, route or fare."
          />
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <GlassCard tier={2} className="p-6 sm:p-8">
            <h3 className="mb-4 text-base font-semibold text-ink-heading">Each option shows</h3>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {quoteOptionDetails.map((item) => (
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

interface QuoteValiditySectionProps {
  /** Max quote validity in minutes — Admin Timeline config, falling back to the doc's 30. */
  validityMinutes: number;
}

/** Doc §9 — limited-time quote, countdown, expiry behaviour, reminders. */
export function QuoteValiditySection({ validityMinutes }: QuoteValiditySectionProps) {
  const minutesLabel = `${validityMinutes} ${validityMinutes === 1 ? "minute" : "minutes"}`;
  return (
    <section className="py-16 sm:py-20">
      <Container className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <MotionReveal>
          <div className="flex flex-col gap-5">
            <SectionHeading eyebrow="Limited-time quote" title="Your fare is available for a limited time" />
            <p className="text-sm text-ink-secondary sm:text-base">
              A Special Fare quotation can be valid for a maximum of {minutesLabel}. The customer sees a countdown
              while the quotation is active.
            </p>
            <p className="text-sm text-ink-secondary sm:text-base">
              Payment is blocked after the quote expires and the old quote cannot simply be reused.
            </p>
            <p className="flex items-start gap-2.5 text-sm text-ink-tertiary">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-ink-accent" aria-hidden="true" />
              While valid, reminders can be sent every 10 minutes; reminders stop after expiry.
            </p>
          </div>
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <div className="flex flex-col gap-4">
            <GlassCard tier={2} className="flex items-center gap-4 p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <Timer className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">Maximum validity</span>
                <span className="text-2xl font-semibold tracking-tight text-ink-heading">{minutesLabel}</span>
              </div>
            </GlassCard>
            <GlassCard tier={2} className="flex flex-col gap-4 border border-warning/30 p-6">
              <span className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">After expiry:</span>
              <p className="flex items-start gap-2.5 text-base font-medium text-ink-heading">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                &ldquo;This Special Fare quotation has expired.&rdquo;
              </p>
              <ButtonLink href={REQUEST_HREF} variant="primary" size="md" className="self-start">
                Request New Quote
              </ButtonLink>
            </GlassCard>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
