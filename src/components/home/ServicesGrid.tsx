import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { ServiceCard } from "./ServiceCard";
import { db } from "@/lib/db";
import { SERVICE_ROUTE_INFO } from "@/lib/service-route-info";
import { SERVICE_ICON_MAP } from "@/lib/service-icons";
import { headerActions } from "@/lib/nav-config";

/**
 * Server Component querying the Service table directly (not via the public
 * /api/services route — same server, no reason to round-trip HTTP) so an
 * Admin renaming, reordering, or disabling a service (Step 6.2,
 * client-locked-spec roadmap) shows up here with zero deploys. Falls back
 * to skipping a row if its code has no matching SERVICE_ROUTE_INFO entry
 * (shouldn't happen for the 6 locked services, but a stray/misconfigured
 * row must never crash the homepage).
 */
export async function ServicesGrid() {
  const services = await db.service.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

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
            const routeInfo = SERVICE_ROUTE_INFO[service.code];
            const Icon = SERVICE_ICON_MAP[service.iconName];
            if (!routeInfo || !Icon) return null;
            return (
              <MotionReveal key={service.id} delay={index * 0.05}>
                <ServiceCard
                  title={service.name}
                  description={service.shortDescription}
                  href={routeInfo.href}
                  image={routeInfo.image}
                  imageAlt={routeInfo.imageAlt}
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
