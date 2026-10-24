import { Bus, CheckCircle2, Plane, Route, XCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

/**
 * Doc §6 method cards + §6A "How Airports and Borders Work". Locked content — doc §6, with the inclusions from
 * the client correction of 2026-10-05 and the method names and descriptions from client testing 2026-10-09
 * (B22); all Admin-editable (Website Pages). Quotations keep their own defaults (`lib/visa-change/inclusions`).
 */
export function VisaChangeMethods({ content }: { content: SitePageContentView }) {
  const items = (key: string) => content.list(key).map(([item]) => item);
  const methods = [
    { title: content.text("methods.a2aTitle"), description: content.text("methods.a2aDescription"), Icon: Plane, included: items("methods.a2aIncluded") },
    { title: content.text("methods.borderTitle"), description: content.text("methods.borderDescription"), Icon: Bus, included: items("methods.borderIncluded") },
  ];
  const notIncluded = items("methods.notIncluded");
  const includedLabel = content.text("methods.includedLabel");
  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow={content.text("methods.eyebrow")}
            title={content.text("methods.heading")}
            className="mx-auto"
          />
        </MotionReveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {methods.map(({ title, description, Icon, included }, index) => (
            <MotionReveal key={`${index}-${title}`} delay={index * 0.06}>
              <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold text-ink-heading">{title}</h3>
                <p className="text-sm text-ink-secondary sm:text-base">{description}</p>
                <div className="mt-auto flex flex-col gap-2 border-t border-hairline pt-4">
                  <p className="text-xs font-semibold tracking-wide text-ink-accent uppercase">{includedLabel}</p>
                  <ul className="flex flex-col gap-1.5">
                    {included.map((item, itemIndex) => (
                      <li key={`${itemIndex}-${item}`} className="flex items-start gap-2 text-sm text-ink-secondary">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </GlassCard>
            </MotionReveal>
          ))}
        </div>

        <MotionReveal delay={0.08}>
          <GlassCard tier={1} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6">
            <p className="text-sm font-semibold text-ink-heading">{content.text("methods.notIncludedLabel")}</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {notIncluded.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`} className="flex items-center gap-2 text-sm text-ink-secondary">
                  <XCircle className="h-4 w-4 shrink-0 text-ink-tertiary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </GlassCard>
        </MotionReveal>

        <MotionReveal delay={0.1}>
          <GlassCard tier={1} className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <Route className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">
                {content.text("methods.routeEyebrow")}
              </span>
              <h3 className="text-lg font-semibold text-ink-heading">{content.text("methods.routeHeading")}</h3>
              <p className="text-sm text-ink-secondary sm:text-base">
                {content.text("methods.routeBody")}
              </p>
            </div>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
