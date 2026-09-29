import { Scale, PlaneLanding } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

/** P19 — RVT Page Content v3 §12 "Travel & Immigration Disclaimer" and §13 "After Travel" (locked copy). */
export function DisclaimerAfterTravelSection() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MotionReveal className="h-full">
          <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <Scale className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-semibold text-ink-heading">Travel &amp; immigration disclaimer</h2>
            </div>
            <p className="text-sm text-ink-secondary">
              TripNexio is a return-ticket service provider. TripNexio is not responsible for airline boarding
              decisions, immigration clearance, border decisions, visa decisions or entry decisions made by the
              relevant airline or authority.
            </p>
            <p className="text-sm text-ink-secondary">
              Airline schedules, cancellations, rescheduling, denied boarding and immigration or border decisions are
              outside TripNexio&rsquo;s control. Customers remain responsible for complying with applicable airline,
              visa and immigration requirements, subject to the agreed Terms &amp; Conditions.
            </p>
          </GlassCard>
        </MotionReveal>

        <MotionReveal delay={0.08} className="h-full">
          <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <PlaneLanding className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">Completion</span>
                <h2 className="text-base font-semibold text-ink-heading">After travel</h2>
              </div>
            </div>
            <p className="text-sm text-ink-secondary">
              Once the planned travel schedule has passed, the Return Verified Ticket booking can be automatically
              marked completed according to the configured post-travel workflow.
            </p>
            <p className="text-sm text-ink-secondary">
              You don&rsquo;t need to manually close the service unless the configured workflow specifically requests
              an action. Your issued ticket and booking history stay available in your customer record.
            </p>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
