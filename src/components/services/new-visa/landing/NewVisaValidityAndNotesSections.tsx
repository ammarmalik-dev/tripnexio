import { CalendarCheck, CalendarRange, CheckCircle2, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

// Locked content — UAE Visa Page Content FINAL §10 "Visa Validity & Stay".
const validityCards: { title: string; description: string; Icon: LucideIcon }[] = [
  {
    title: "Visa Validity",
    description: "The period within which you must enter the UAE according to the issued visa.",
    Icon: CalendarCheck,
  },
  {
    title: "Stay Duration",
    description: "The permitted period you may remain in the UAE according to the issued visa conditions.",
    Icon: CalendarRange,
  },
];

// Locked content — UAE Visa Page Content FINAL §11 "Important Before You Apply".
const beforeYouApply = [
  "Provide accurate applicant and traveller information.",
  "Upload clear, genuine and readable documents when requested.",
  "Make sure the selected visa option matches the intended trip.",
  "Processing time does not guarantee visa approval or a fixed authority decision.",
  "Final visa decisions and immigration permissions are determined by the relevant UAE authority.",
];

/** New Visa landing — visa validity vs. stay duration (doc §10). */
export function NewVisaValiditySection() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading align="center" title="Visa validity & stay" className="mx-auto" />
        </MotionReveal>
        <ul className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          {validityCards.map(({ title, description, Icon }, index) => (
            <li key={title} className="h-full">
              <MotionReveal delay={index * 0.06} className="h-full">
                <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-semibold text-ink-heading">{title}</h3>
                  <p className="text-sm text-ink-secondary sm:text-base">{description}</p>
                </GlassCard>
              </MotionReveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** New Visa landing — "Important before you apply" checklist (doc §11). */
export function NewVisaBeforeYouApplySection() {
  return (
    <section className="py-16 sm:py-20">
      <Container>
        <MotionReveal>
          <GlassCard tier={2} className="mx-auto flex max-w-3xl flex-col gap-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-xl font-semibold text-ink-heading sm:text-2xl">Important before you apply</h2>
            </div>
            <ul className="flex flex-col gap-3">
              {beforeYouApply.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary sm:text-base">
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
