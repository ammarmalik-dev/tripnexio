import { MapPin, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

/**
 * Locked content — TripNexio_Visa_Change_Final_Page_Content_Design_FAQ_FINAL_V3
 * §4 "What Is Visa Change?" and §5 "Where Can I Apply?" (one horizontal
 * "Inside UAE only" reassurance card, per the doc's design note).
 */
export function VisaChangeOverview() {
  return (
    <>
      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-4">
          <MotionReveal>
            <SectionHeading
              eyebrow="What is Visa Change?"
              title="Your UAE Visa Change, guided end to end"
              className="max-w-3xl"
            />
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <div className="flex max-w-3xl flex-col gap-3 text-sm text-ink-secondary sm:text-base">
              <p>
                Visa Change helps eligible travellers already in the UAE move through an available
                exit-and-new-visa process. Choose Airport-to-Airport or Border Exit, submit your details, and
                TripNexio coordinates the next steps once availability is confirmed.
              </p>
              <p>The service has two methods: Airport-to-Airport (A2A) and Border Exit.</p>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-8">
          <MotionReveal>
            <SectionHeading
              eyebrow="Currently in the UAE"
              title="Visa Change is available from inside the UAE"
              className="max-w-3xl"
            />
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <GlassCard tier={2} className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-8 sm:p-8">
              <div className="flex shrink-0 items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-lg font-semibold text-ink-heading">Inside UAE only</p>
              </div>
              <div className="flex flex-col gap-3 text-sm text-ink-secondary sm:text-base">
                <p>
                  This service is for travellers who are currently in the UAE. Customers outside the UAE should
                  use the relevant New Visa service instead.
                </p>
                <p className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-ink-heading">Eligibility: </span>
                    Visa Change can be requested by eligible UAE tourist visa holders and eligible holders of a
                    cancelled UAE residence visa, subject to applicable immigration requirements, document checks,
                    availability and the final decision of the relevant authority.
                  </span>
                </p>
              </div>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
