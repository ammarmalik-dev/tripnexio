import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { DestinationCard } from "./DestinationCard";
import { destinations } from "@/lib/destinations-config";

export function DestinationsGrid() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <MotionReveal>
          <SectionHeading
            eyebrow="Where we operate"
            title="Popular GCC destinations"
            description="Visa and flight services across the UAE and GCC. Pick a destination to start a request — our team takes it from there."
          />
        </MotionReveal>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {destinations.map((destination, index) => (
            <MotionReveal key={destination.code} delay={index * 0.05}>
              <DestinationCard destination={destination} />
            </MotionReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
