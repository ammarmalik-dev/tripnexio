import type { LucideIcon } from "lucide-react";
import { UserRound, Users, Baby } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

interface PassengerType {
  icon: LucideIcon;
  label: string;
  age: string;
}

// Locked content — doc §6 "Passenger Types & Pricing".
const passengerTypes: PassengerType[] = [
  { icon: UserRound, label: "Adult", age: "12+" },
  { icon: Users, label: "Child", age: "2–11" },
  { icon: Baby, label: "Infant", age: "Under 2" },
];

/** Doc §6 — Adult / Child / Infant, classified from DOB and age on the travel date. */
export function PassengerTypes() {
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <MotionReveal>
          <SectionHeading
            eyebrow="Passenger types"
            title="Your fare is calculated for each traveller"
            description="Passenger type is calculated from date of birth and age on the travel date:"
          />
        </MotionReveal>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {passengerTypes.map(({ icon: Icon, label, age }, index) => (
            <li key={label}>
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
