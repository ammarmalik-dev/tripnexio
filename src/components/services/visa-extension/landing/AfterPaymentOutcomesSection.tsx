import { BadgeCheck, Loader, FileText, Send, RotateCcw, Ban, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Icons by position; extra cards Admin adds cycle through them.
// Locked content — UAE Visa Extension page doc §10 "After Payment".
const STAGE_ICONS: LucideIcon[] = [BadgeCheck, Loader, FileText, Send];
// Locked content — doc §11 "Outcomes". Kept as two distinct labels on purpose.
const OUTCOME_ICONS: LucideIcon[] = [RotateCcw, Ban];

// Wording from Admin → Website Pages (blank = the locked copy).
export function AfterPaymentOutcomesSection({ content }: { content: SitePageContentView }) {
  const afterPayment = content.list("afterPayment.items", 2).map(([title, body], index) => ({
    title,
    body,
    icon: STAGE_ICONS[index % STAGE_ICONS.length],
  }));
  const outcomes = content.list("outcomes.items", 2).map(([title, body], index) => ({
    title,
    body,
    icon: OUTCOME_ICONS[index % OUTCOME_ICONS.length],
  }));

  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col gap-10">
          <MotionReveal>
            <SectionHeading align="center" eyebrow={content.text("afterPayment.eyebrow")} title={content.text("afterPayment.heading")} className="mx-auto" />
          </MotionReveal>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {afterPayment.map(({ title, body, icon: Icon }, index) => (
              <li key={`${index}-${title}`}>
                <MotionReveal delay={index * 0.05} className="h-full">
                  <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold text-ink-muted" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-ink-heading">{title}</h3>
                    <p className="text-sm text-ink-secondary">{body}</p>
                  </GlassCard>
                </MotionReveal>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-10">
          <MotionReveal>
            <SectionHeading
              align="center"
              eyebrow={content.text("outcomes.eyebrow")}
              title={content.text("outcomes.heading")}
              description={content.text("outcomes.intro")}
              className="mx-auto"
            />
          </MotionReveal>
          <ul className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            {outcomes.map(({ title, body, icon: Icon }, index) => (
              <li key={`${index}-${title}`}>
                <MotionReveal delay={index * 0.06} className="h-full">
                  <GlassCard tier={2} className="flex h-full items-start gap-4 p-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-secondary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-semibold text-ink-heading">{title}</h3>
                      <p className="text-sm text-ink-secondary">{body}</p>
                    </div>
                  </GlassCard>
                </MotionReveal>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
