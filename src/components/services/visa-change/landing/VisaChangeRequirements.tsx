import { CalendarClock, Camera, Files, Globe, IdCard, Mail, Phone, User, UserCheck, FileText } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

// Locked content — doc §8 "What You'll Need".
const whatYoullNeed = [
  { title: "Full name", description: "Applicant / passenger name", Icon: User },
  { title: "Mobile number", description: "Active contact number", Icon: Phone },
  { title: "Email address", description: "Email for updates and confirmations", Icon: Mail },
  { title: "Passport number", description: "Required passenger identifier", Icon: IdCard },
  { title: "Visa expiry date", description: "Current visa last date", Icon: CalendarClock },
  { title: "Nationality", description: "Used for applicable documents and nationality-wise pricing", Icon: Globe },
] as const;

// Locked content — doc §9 "Documents Required" (visual cards; the real
// checklist is nationality-based and Admin-configured, so no universal list).
const documents = [
  { title: "Passport", description: "Passport copy as requested", Icon: FileText },
  { title: "Passport Photograph", description: "Recent photograph when required", Icon: Camera },
  { title: "Additional Documents", description: "Nationality/service-specific documents where required", Icon: Files },
] as const;

/** Doc §7 "Who Can Apply?", §8 "What You'll Need", §9 "Documents Required". */
export function VisaChangeRequirements() {
  return (
    <>
      <section className="py-16 sm:py-20">
        <Container>
          <MotionReveal>
            <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-8">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <UserCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading
                eyebrow="Eligibility"
                title="Visa Change for eligible travellers in the UAE"
                description="TripNexio accepts Visa Change requests from eligible travellers who are currently in the UAE, including tourist visa holders and eligible cancelled residence visa holders, subject to the applicable immigration requirements and confirmed availability."
              />
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10">
          <MotionReveal>
            <SectionHeading align="center" title="What you’ll need" className="mx-auto" />
          </MotionReveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {whatYoullNeed.map(({ title, description, Icon }, index) => (
              <MotionReveal key={title} delay={index * 0.04}>
                <GlassCard tier={2} className="flex h-full items-start gap-3 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-ink-heading">{title}</h3>
                    <p className="text-sm text-ink-secondary">{description}</p>
                  </div>
                </GlassCard>
              </MotionReveal>
            ))}
          </div>
          <MotionReveal>
            <p className="text-center text-sm text-ink-tertiary">
              You can add another passenger. Each passenger has their own nationality and Adult/Child details.
            </p>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10">
          <MotionReveal>
            <SectionHeading align="center" title="Documents required" className="mx-auto" />
          </MotionReveal>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {documents.map(({ title, description, Icon }, index) => (
              <MotionReveal key={title} delay={index * 0.06}>
                <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-ink-heading">{title}</h3>
                  <p className="text-sm text-ink-secondary">{description}</p>
                </GlassCard>
              </MotionReveal>
            ))}
          </div>
          <MotionReveal>
            <div className="mx-auto flex max-w-2xl flex-col gap-2 text-center text-sm text-ink-tertiary">
              <p>
                Document requirements may vary by nationality and application. Additional documents may be
                requested where required.
              </p>
              <p>Actual upload occurs after successful payment. Existing valid documents may be reused where available.</p>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
