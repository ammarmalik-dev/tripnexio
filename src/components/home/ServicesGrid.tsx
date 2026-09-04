import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { ServiceCard } from "./ServiceCard";
import { services } from "@/lib/services-config";
import { headerActions } from "@/lib/nav-config";

export function ServicesGrid() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <MotionReveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Everything TripNexio offers"
              title="Explore our services"
              description="UAE and GCC visa and flight services, requested online and processed by our team from start to finish."
            />
            <Link
              href={headerActions.getStarted.href}
              className="flex items-center gap-1.5 text-sm font-medium text-ink-accent transition-colors duration-200 hover:text-ink-primary"
            >
              View all services
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </MotionReveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <MotionReveal key={service.key} delay={index * 0.05}>
                <ServiceCard
                  title={service.title}
                  description={service.description}
                  href={service.href}
                  image={service.image}
                  imageAlt={service.imageAlt}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                />
              </MotionReveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
