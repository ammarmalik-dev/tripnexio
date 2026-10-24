import type { LucideIcon } from "lucide-react";
import { UserRound, Users, Baby } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Locked content — doc §6 "Passenger Types & Pricing"; the wording is edited in Admin → Website Pages, icons cycle by position.
const passengerIcons: LucideIcon[] = [UserRound, Users, Baby];

interface PassengerTypesProps {
  content: SitePageContentView;
}

/** Doc §6 — Adult / Child / Infant, classified from DOB and age on the travel date. */
export function PassengerTypes({ content }: PassengerTypesProps) {
  const passengerTypes = content.list("passengerTypes.cards", 2).map(([label, age], index) => ({
    icon: passengerIcons[index % passengerIcons.length],
    label,
    age,
  }));
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <SectionHeading
            eyebrow={content.text("passengerTypes.eyebrow")}
            title={content.text("passengerTypes.title")}
            description={content.text("passengerTypes.intro")}
          />
        </MotionReveal>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {passengerTypes.map(({ icon: Icon, label, age }, index) => (
            <li key={`${index}-${label}`}>
              <MotionReveal delay={index * 0.06} className="h-full">
                <GlassCard tier={2} className="flex h-full flex-col items-center gap-2 p-6 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-ink-heading">{label}</h3>
                  <p className="text-2xl font-semibold tracking-tight text-ink-accent">{age}</p>
                </GlassCard>
              </MotionReveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
