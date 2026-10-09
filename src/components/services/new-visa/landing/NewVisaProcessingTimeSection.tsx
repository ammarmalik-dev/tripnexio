import { CalendarCheck, CalendarRange, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { getNewVisaTravelRules } from "@/lib/new-visa/travel-rules";
import type { NewVisaTravelRules } from "@/lib/new-visa/products";

/** The country's timeline (Admin → Timelines, per country first); null when it can't be read. */
async function loadRules(countryCode: string): Promise<NewVisaTravelRules | null> {
  try {
    return await getNewVisaTravelRules(countryCode);
  } catch (error) {
    console.error("[new-visa-landing] couldn't load processing timelines", error);
    return null;
  }
}

const workingDays = (days: number) => `${days} working day${days === 1 ? "" : "s"}`;

/** "Normal: 5 working days · Express: 2 working days", from Admin values only — never a guessed number. */
function processingCopy(rules: NewVisaTravelRules | null): string {
  if (!rules) return "Shown when you apply.";
  const parts: string[] = [];
  if (rules.processingDaysNormal != null) parts.push(`Normal: ${workingDays(rules.processingDaysNormal)}`);
  if (rules.processingDaysExpress != null) parts.push(`Express: ${workingDays(rules.processingDaysExpress)}`);
  if (parts.length > 0) return parts.join(" · ");
  return `Apply at least ${workingDays(rules.minTravelDaysNormal)} before travel (Normal), or ${workingDays(rules.minTravelDaysExpress)} with Express.`;
}

/**
 * Client testing 2026-10-09 (B30) — Processing Time | Visa Stay | Visa
 * Validity together in one row on the country page. Stay and validity are the
 * page's Admin text; a card without text is left out.
 */
export async function NewVisaProcessingTimeSection({
  countryCode,
  stayText,
  validityText,
}: {
  countryCode: string;
  stayText?: string | null;
  validityText?: string | null;
}) {
  const rules = await loadRules(countryCode);
  const facts: { title: string; copy: string; Icon: LucideIcon }[] = [
    { title: "Processing Time", copy: processingCopy(rules), Icon: Timer },
    ...(stayText ? [{ title: "Visa Stay", copy: stayText, Icon: CalendarRange }] : []),
    ...(validityText ? [{ title: "Visa Validity", copy: validityText, Icon: CalendarCheck }] : []),
  ];
  const columns = facts.length === 3 ? "sm:grid-cols-3" : facts.length === 2 ? "sm:grid-cols-2" : "";

  return (
    <section className="py-10 sm:py-14">
      <Container>
        <ul className={`mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 ${columns}`}>
          {facts.map(({ title, copy, Icon }, index) => (
            <li key={title} className="h-full">
              <MotionReveal delay={index * 0.06} className="h-full">
                <GlassCard tier={2} className="flex h-full items-start gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold tracking-wide text-ink-tertiary uppercase">{title}</h3>
                    <p className="mt-1 text-sm font-medium text-ink-heading sm:text-base">{copy}</p>
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
