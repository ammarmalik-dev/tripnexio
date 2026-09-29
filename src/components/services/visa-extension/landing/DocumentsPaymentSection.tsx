import { FileStack, CreditCard, ShieldCheck, Clock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MotionReveal } from "@/components/motion/MotionReveal";

/**
 * Locked content — UAE Visa Extension page doc §8 "Documents" and §9 "Payment".
 * Payment-link validity comes from the Admin Timeline/SLA config (page falls
 * back to the doc's locked 24 hours). The doc's "Pay Now" lives on the
 * customer's own tokenised payment link (sent after the eligibility review) —
 * a landing page has nothing to pay yet, so this card starts the request and
 * links to Payment Support for help with an existing link.
 */
export function DocumentsPaymentSection({ paymentLinkHours }: { paymentLinkHours: number }) {
  const hoursLabel = `${paymentLinkHours} ${paymentLinkHours === 1 ? "hour" : "hours"}`;

  return (
    <section className="py-16 sm:py-20">
      <Container className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <MotionReveal className="h-full">
          <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <FileStack className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-heading">Documents</h2>
            <p className="text-sm text-ink-secondary sm:text-base">
              We may use eligible documents already available in your TripNexio records after your confirmation. If
              additional information or documents are required, we&apos;ll let you know.
            </p>
            <p className="mt-auto flex items-start gap-2.5 rounded-lg border border-hairline bg-surface-1 p-4 text-sm font-medium text-ink-primary">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              Existing documents are never reused without your confirmation.
            </p>
          </GlassCard>
        </MotionReveal>

        <MotionReveal delay={0.08} className="h-full">
          <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-heading">
              Pay after your extension is reviewed
            </h2>
            <p className="text-sm text-ink-secondary sm:text-base">
              Your final amount is provided after your visa details and extension eligibility are reviewed. The total
              may include the extension fee, applicable fine or overstay amount, and other applicable charges.
            </p>
            <p className="flex items-start gap-2.5 text-sm text-ink-secondary">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-on-light" aria-hidden="true" />
              <span>
                Payment-link validity: {hoursLabel}. If the link expires, the TripNexio team can generate a new link.
              </span>
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <ButtonLink href="/services/visa-extension/request" variant="primary" size="md">
                Request Extension
              </ButtonLink>
              <ButtonLink href="/payment-support" variant="glass" size="md">
                Payment Support
              </ButtonLink>
            </div>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
