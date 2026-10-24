import { SearchCheck, CalendarClock, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Locked content — RVT Page Content v3 §9 "Verification" and §10 "Issue
// Timing" (the fallback copy in src/lib/site-content/sections/return-ticket.ts,
// editable in Admin → Website Pages). §10's issue-window figures are a developer
// note (to stay configurable per destination/partner), so no window is stated here.
export function VerificationTimingSection({ content }: { content: SitePageContentView }) {
  const verificationDetails = content.list("verification.cardPoints").map((row) => row.join(" | "));
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <div className="flex flex-col gap-5">
            <SectionHeading eyebrow={content.text("verification.eyebrow")} title={content.text("verification.title")} />
            <p className="text-sm text-ink-secondary sm:text-base">{content.text("verification.intro")}</p>
            <GlassCard tier={2} className="flex flex-col gap-3 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <SearchCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-base font-semibold text-ink-heading">{content.text("verification.cardTitle")}</p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {verificationDetails.map((item, index) => (
                  <li key={`${index}-${item}`} className="flex items-start gap-2.5 text-sm text-ink-secondary">
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
              {content.text("verification.timingTitle")}
            </span>
            <p className="text-sm text-ink-on-dark-secondary sm:text-base">{content.text("verification.timingBody")}</p>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
