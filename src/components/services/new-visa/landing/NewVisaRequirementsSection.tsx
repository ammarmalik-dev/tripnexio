import { BookOpen, CheckCircle2, ClipboardList, FileText, Info } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

interface NewVisaRequirementsSectionProps {
  /** "What you'll need" checklist (Admin → New Visa Country Pages). */
  whatYouNeed: string[];
  /** Documents shown as cards. */
  documents: string[];
  documentsNote?: string | null;
}

/**
 * New Visa country page — "What you'll need" checklist + documents cards
 * (UAE Visa Page Content FINAL §6, now per country from Admin). A side with
 * no items is left out; the whole section renders nothing when both are empty.
 */
export function NewVisaRequirementsSection({ whatYouNeed, documents, documentsNote }: NewVisaRequirementsSectionProps) {
  if (whatYouNeed.length === 0 && documents.length === 0) return null;
  const bothSides = whatYouNeed.length > 0 && documents.length > 0;

  return (
    <section className="py-16 sm:py-20">
      <Container className={bothSides ? "grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16" : "mx-auto max-w-3xl"}>
        {whatYouNeed.length > 0 ? (
          <MotionReveal>
            <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-xl font-semibold text-ink-heading">What you&rsquo;ll need</h2>
              </div>
              <ul className="flex flex-col gap-2.5">
                {whatYouNeed.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary sm:text-base">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </MotionReveal>
        ) : null}

        {documents.length > 0 ? (
          <MotionReveal delay={0.08}>
            <div className="flex flex-col gap-5">
              <SectionHeading title="Documents required" />
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {documents.map((title, index) => {
                  const Icon = index === 0 ? BookOpen : FileText;
                  return (
                    <li key={title}>
                      <GlassCard tier={2} className="flex h-full flex-col items-start gap-3 p-5">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <p className="text-sm font-semibold text-ink-heading">{title}</p>
                      </GlassCard>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-on-light" aria-hidden="true" />
                <div className="flex flex-col gap-1.5 text-sm text-ink-secondary">
                  {documentsNote ? (
                    <p>
                      <span className="font-semibold text-ink-heading">Note: </span>
                      {documentsNote}
                    </p>
                  ) : null}
                  <p>After successful payment, your Booking ID is created and the document-upload stage becomes available.</p>
                </div>
              </div>
            </div>
          </MotionReveal>
        ) : null}
      </Container>
    </section>
  );
}
