import { CalendarCheck, CalendarRange, CheckCircle2, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

/**
 * New Visa country page — visa validity vs. stay duration (UAE Visa Page
 * Content FINAL §10, now per country from Admin). A blank text hides its
 * card; nothing renders when both are blank.
 */
export function NewVisaValiditySection({ validityText, stayText }: { validityText?: string | null; stayText?: string | null }) {
  const cards: { title: string; description: string; Icon: LucideIcon }[] = [];
  if (validityText) cards.push({ title: "Visa Validity", description: validityText, Icon: CalendarCheck });
  if (stayText) cards.push({ title: "Stay Duration", description: stayText, Icon: CalendarRange });
  if (cards.length === 0) return null;

  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading align="center" title="Visa validity & stay" className="mx-auto" />
        </MotionReveal>
        <ul className={`mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 ${cards.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {cards.map(({ title, description, Icon }, index) => (
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

/** New Visa country page — "Important before you apply" checklist (doc §11). Nothing renders without items. */
export function NewVisaBeforeYouApplySection({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="py-10 sm:py-14">
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
              {items.map((item) => (
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
