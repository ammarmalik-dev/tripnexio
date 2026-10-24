import { CheckCircle2, Timer, CircleAlert, BellRing } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

const REQUEST_HREF = "/services/flight-special-fare/request";

interface ContentProps {
  content: SitePageContentView;
}

/**
 * Doc §8 — more than one flight option may be sent for the same request. The list ("options.items", edited in
 * Admin → Website Pages) deliberately leaves out the internal partner reference: the doc itself marks it internal.
 */
export function MultipleOptionsSection({ content }: ContentProps) {
  const quoteOptionDetails = content.list("options.items").map((row) => row.join(" | "));
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <SectionHeading
            eyebrow={content.text("options.eyebrow")}
            title={content.text("options.title")}
            description={content.text("options.intro")}
          />
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <GlassCard tier={2} className="p-6 sm:p-8">
            <h3 className="mb-4 text-base font-semibold text-ink-heading">{content.text("options.cardTitle")}</h3>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {quoteOptionDetails.map((item, index) => (
                <li key={`${index}-${item}`} className="flex items-start gap-2.5 text-sm text-ink-secondary">
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

interface QuoteValiditySectionProps extends ContentProps {
  /** Max quote validity in minutes — Admin Timeline config, falling back to the doc's 30. */
  validityMinutes: number;
}

/** Doc §9 — limited-time quote, countdown, expiry behaviour, reminders. */
export function QuoteValiditySection({ content, validityMinutes }: QuoteValiditySectionProps) {
  const minutesLabel = `${validityMinutes} ${validityMinutes === 1 ? "minute" : "minutes"}`;
  // "{minutes}" in the wording stands for the configured validity, so the figure always matches the CRM cap.
  const paragraphs = content
    .list("validity.paragraphs")
    .map((row) => row.join(" | ").replaceAll("{minutes}", minutesLabel));
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <div className="flex flex-col gap-5">
            <SectionHeading eyebrow={content.text("validity.eyebrow")} title={content.text("validity.title")} />
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="text-sm text-ink-secondary sm:text-base">
                {paragraph}
              </p>
            ))}
            <p className="flex items-start gap-2.5 text-sm text-ink-tertiary">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-ink-accent" aria-hidden="true" />
              {content.text("validity.reminderNote")}
            </p>
          </div>
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <div className="flex flex-col gap-4">
            <GlassCard tier={2} className="flex items-center gap-4 p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <Timer className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">{content.text("validity.maxLabel")}</span>
                <span className="text-2xl font-semibold tracking-tight text-ink-heading">{minutesLabel}</span>
              </div>
            </GlassCard>
            <GlassCard tier={2} className="flex flex-col gap-4 border border-warning/30 p-6">
              <span className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">{content.text("validity.expiryLabel")}</span>
              <p className="flex items-start gap-2.5 text-base font-medium text-ink-heading">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                &ldquo;{content.text("validity.expiryMessage")}&rdquo;
              </p>
              <ButtonLink href={REQUEST_HREF} variant="primary" size="md" className="self-start">
                {content.text("validity.buttonLabel")}
              </ButtonLink>
            </GlassCard>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
