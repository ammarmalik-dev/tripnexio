import { Bus, CheckCircle2, Plane } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

// Locked content — doc §12 "Confirmed Options". The values themselves come
// from the CRM per booking; this only lists what the customer will be shown.
const options = [
  {
    title: "A2A",
    Icon: Plane,
    items: ["Exit & Re-entry Airport", "Airline", "Flight", "Date", "Time", "Reporting Time", "Package details"],
  },
  {
    title: "Border Exit",
    Icon: Bus,
    items: [
      "Border Name",
      "Pickup Location",
      "Pickup Person",
      "Pickup Contact",
      "Reporting Time",
      "Travel Time",
      "Drop / Border Location",
      "Package details",
    ],
  },
] as const;

export function VisaChangeConfirmedOptions() {
  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading
            align="center"
            title="Confirmed Options"
            eyebrow="A2A / Border package"
            description="You select one confirmed package. These details are supplied by TripNexio; you do not manually enter them."
            className="mx-auto"
          />
        </MotionReveal>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {options.map(({ title, Icon, items }, index) => (
            <MotionReveal key={title} delay={index * 0.06}>
              <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-semibold text-ink-heading">{title}</h3>
                </div>
                <p className="text-sm text-ink-tertiary">After availability is confirmed, you will see:</p>
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
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
