import { Bus, CheckCircle2, Plane } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Client doc 2026-10-15 (E1) — the client's lists, word for word (Admin-editable via Website Pages).
// The values themselves come from the CRM per booking; this only lists what the customer will be shown.
export function VisaChangeConfirmedOptions({ content }: { content: SitePageContentView }) {
  const options = [
    { title: content.text("confirmed.a2aTitle"), Icon: Plane, items: content.list("confirmed.a2aItems").map(([item]) => item) },
    { title: content.text("confirmed.borderTitle"), Icon: Bus, items: content.list("confirmed.borderItems").map(([item]) => item) },
  ];
  const cardLead = content.text("confirmed.cardLead");
  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading
            align="center"
            title={content.text("confirmed.heading")}
            eyebrow={content.text("confirmed.eyebrow")}
            description={content.text("confirmed.intro")}
            className="mx-auto"
          />
        </MotionReveal>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {options.map(({ title, Icon, items }, index) => (
            <MotionReveal key={`${index}-${title}`} delay={index * 0.06}>
              <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-semibold text-ink-heading">{title}</h3>
                </div>
                <p className="text-sm text-ink-tertiary">{cardLead}</p>
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {items.map((item, itemIndex) => (
                    <li key={`${itemIndex}-${item}`} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </MotionReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
