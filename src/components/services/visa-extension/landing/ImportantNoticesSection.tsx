import { CalendarClock, CalendarX2, AlertTriangle, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

interface Notice {
  title: string;
  body: string;
  icon: LucideIcon;
}

// Locked content — UAE Visa Extension page doc §7 "Important before you request an extension".
const notices: Notice[] = [
  {
    title: "Actual expiry is checked during review",
    body: "The expiry date used for your request must be your current visa expiry date. Any estimated timing is not a confirmed expiry date.",
    icon: CalendarClock,
  },
  {
    title: "30+ days expired",
    body: "If the visa has been expired for 30 days or more, it is not eligible for the 30-day Visa Extension.",
    icon: CalendarX2,
  },
  {
    title: "Visa expires today",
    body: "Same-day expiry cases require urgent handling. The current operational payment deadline is 6:00 PM on the same working day. Applicable fines remain subject to the relevant authority rules.",
    icon: AlertTriangle,
  },
];

export function ImportantNoticesSection() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow="Good to know"
            title="Important before you request an extension"
            className="mx-auto"
          />
        </MotionReveal>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {notices.map(({ title, body, icon: Icon }, index) => (
            <li key={title}>
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
