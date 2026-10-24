import { CalendarPlus, ShieldCheck, Receipt, Scale, Link2, CalendarCheck2, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Icons by position; extra cards Admin adds cycle through them.
const DETAIL_ICONS: LucideIcon[] = [CalendarPlus, ShieldCheck, Receipt, Scale, Link2, CalendarCheck2];

/**
 * Locked content — UAE Visa Extension page doc §6 "UAE Visa Extension Details".
 * The payment-link validity is read from the Admin Timeline/SLA config by the
 * page (falls back to the doc's locked 24 hours) and fills the wording's {hours}.
 * Wording from Admin → Website Pages (blank = this locked copy).
 */
export function ExtensionDetailsSection({ paymentLinkHours, content }: { paymentLinkHours: number; content: SitePageContentView }) {
  const hoursLabel = `${paymentLinkHours} ${paymentLinkHours === 1 ? "hour" : "hours"}`;
  const details = content.list("details.items", 2).map(([label, value], index) => ({
    label,
    value: value.replaceAll("{hours}", hoursLabel),
    icon: DETAIL_ICONS[index % DETAIL_ICONS.length],
  }));

  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading align="center" eyebrow={content.text("details.eyebrow")} title={content.text("details.heading")} className="mx-auto" />
        </MotionReveal>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(({ label, value, icon: Icon }, index) => (
            <li key={`${index}-${label}`}>
              <MotionReveal delay={index * 0.04} className="h-full">
                <GlassCard tier={2} className="flex h-full items-start gap-4 p-5 sm:p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium text-ink-tertiary">{label}</h3>
                    <p className="text-base font-semibold text-ink-heading">{value}</p>
                  </div>
                </GlassCard>
              </MotionReveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
