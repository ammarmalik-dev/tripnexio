import { BookOpen, BookOpenCheck, Camera, CheckCircle2, ClipboardList, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

// Locked content — UAE Visa Page Content FINAL §6 "What You'll Need + Documents".
const whatYoullNeed = [
  "Applicant name, mobile number and email address",
  "Traveller basic details",
  "Occupation / profile information",
  "Expected travel date",
  "Selected visa option, visa type and processing preference",
];

const documentsRequired: { title: string; Icon: LucideIcon }[] = [
  { title: "Passport Front Page", Icon: BookOpen },
  { title: "Passport Last Page", Icon: BookOpenCheck },
  { title: "Passport Photograph", Icon: Camera },
];

/** New Visa landing — "What you'll need" checklist + the standard documents checklist (doc §6). */
export function NewVisaRequirementsSection() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <MotionReveal>
          <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-xl font-semibold text-ink-heading">What you&rsquo;ll need</h2>
            </div>
            <ul className="flex flex-col gap-2.5">
              {whatYoullNeed.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </GlassCard>
        </MotionReveal>

        <MotionReveal delay={0.08}>
          <div className="flex flex-col gap-5">
            <SectionHeading title="Documents required" />
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {documentsRequired.map(({ title, Icon }) => (
                <li key={title}>
                  <GlassCard tier={2} className="flex h-full flex-col items-start gap-3 p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold text-ink-heading">{title}</p>
                  </GlassCard>
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-on-light" aria-hidden="true" />
              <div className="flex flex-col gap-1.5 text-sm text-ink-secondary">
                <p>
                  <span className="font-semibold text-ink-heading">Note: </span>
                  Additional documents may be requested depending on the application, traveller profile or authority requirements.
                </p>
                <p>After successful payment, your Booking ID is created and the document-upload stage becomes available.</p>
              </div>
            </div>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
