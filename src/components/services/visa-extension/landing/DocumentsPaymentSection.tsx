import { FileStack, CreditCard, ShieldCheck, Clock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

/**
 * Locked content — UAE Visa Extension page doc §8 "Documents" and §9 "Payment".
 * Payment-link validity comes from the Admin Timeline/SLA config (page falls
 * back to the doc's locked 24 hours). The doc's "Pay Now" lives on the
 * customer's own tokenised payment link (sent after the eligibility review) —
 * a landing page has nothing to pay yet, so this card starts the request and
 * links to Payment Support for help with an existing link.
 * Wording from Admin → Website Pages (blank = this locked copy); {hours} = the link validity.
 */
export function DocumentsPaymentSection({ paymentLinkHours, content }: { paymentLinkHours: number; content: SitePageContentView }) {
  const hoursLabel = `${paymentLinkHours} ${paymentLinkHours === 1 ? "hour" : "hours"}`;

  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <MotionReveal className="h-full">
          <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <FileStack className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-heading">{content.text("documentsPayment.documentsHeading")}</h2>
            <p className="text-sm text-ink-secondary sm:text-base">{content.text("documentsPayment.documentsBody")}</p>
            <p className="mt-auto flex items-start gap-2.5 rounded-lg border border-hairline bg-surface-1 p-4 text-sm font-medium text-ink-primary">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              {content.text("documentsPayment.documentsNote")}
            </p>
          </GlassCard>
        </MotionReveal>

        <MotionReveal delay={0.08} className="h-full">
          <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-heading">
              {content.text("documentsPayment.paymentHeading")}
            </h2>
            <p className="text-sm text-ink-secondary sm:text-base">{content.text("documentsPayment.paymentBody")}</p>
            <p className="flex items-start gap-2.5 text-sm text-ink-secondary">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-on-light" aria-hidden="true" />
              <span>{content.text("documentsPayment.paymentNote").replaceAll("{hours}", hoursLabel)}</span>
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <ButtonLink href="/services/visa-extension/request" variant="primary" size="md">
                {content.text("documentsPayment.requestLabel")}
              </ButtonLink>
              <ButtonLink href="/payment-support" variant="glass" size="md">
                {content.text("documentsPayment.supportLabel")}
              </ButtonLink>
            </div>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
