import { SearchCheck, CalendarClock, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

// Locked content — RVT Page Content v3 §9 "Verification" and §10 "Issue
// Timing". §10's issue-window figures are a developer note (to stay
// configurable per destination/partner), so no window is stated here.
const verificationDetails = [
  "PNR / reservation reference",
  "Passenger name or other basic reservation information requested by the airline",
];

export function VerificationTimingSection() {
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <div className="flex flex-col gap-5">
            <SectionHeading eyebrow="Verifiable reservation" title="Check your reservation using the PNR" />
            <p className="text-sm text-ink-secondary sm:text-base">
              Where the selected airline/partner process supports online verification, the issued reservation can be
              checked on the airline website using the PNR and the basic reservation information.
            </p>
            <GlassCard tier={2} className="flex flex-col gap-3 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <SearchCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-base font-semibold text-ink-heading">What you&rsquo;ll use to check it</p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {verificationDetails.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </MotionReveal>

        <MotionReveal delay={0.08}>
          <div className="surface-dark-block flex h-full flex-col gap-4 rounded-xl p-6 sm:p-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium tracking-wide text-ink-on-dark-secondary uppercase">
              When we issue the ticket
            </span>
            <p className="text-sm text-ink-on-dark-secondary sm:text-base">
              TripNexio does not promise that the reservation will be issued on the exact day you submit the request.
              We issue the reservation according to ticket availability, partner/airline processing and the configured
              travel schedule.
            </p>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
