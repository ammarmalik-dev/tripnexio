import { CalendarClock, CalendarX2, AlertTriangle, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Icons by position; extra notices Admin adds cycle through them.
const NOTICE_ICONS: LucideIcon[] = [CalendarClock, CalendarX2, AlertTriangle];

// Locked content — UAE Visa Extension page doc §7 "Important before you request an extension".
// Wording from Admin → Website Pages (blank = the locked copy).
export function ImportantNoticesSection({ content }: { content: SitePageContentView }) {
  const notices = content.list("notices.items", 2).map(([title, body], index) => ({
    title,
    body,
    icon: NOTICE_ICONS[index % NOTICE_ICONS.length],
  }));

  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow={content.text("notices.eyebrow")}
            title={content.text("notices.heading")}
            className="mx-auto"
          />
        </MotionReveal>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {notices.map(({ title, body, icon: Icon }, index) => (
            <li key={`${index}-${title}`}>
              <MotionReveal delay={index * 0.06} className="h-full">
                <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 text-warning">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-ink-heading">{title}</h3>
                  <p className="text-sm text-ink-secondary">{body}</p>
                </GlassCard>
              </MotionReveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
