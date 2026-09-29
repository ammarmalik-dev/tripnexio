import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { ServiceCard } from "./ServiceCard";
import { getActiveServices } from "@/lib/services/active-services";
import { SERVICE_ROUTE_INFO } from "@/lib/service-route-info";
import { SERVICE_ICON_MAP } from "@/lib/service-icons";
import { headerActions } from "@/lib/nav-config";
import { lowestOtbStartingPrice } from "@/lib/otb/pricing";

/** P18 — the OTB card's "Starting from" (lowest active Admin price); never blocks the grid if it can't be read. */
async function otbStartingFrom(): Promise<string | undefined> {
  try {
    const price = await lowestOtbStartingPrice();
    return price === null ? undefined : `Starting from ₹${price.toLocaleString("en-IN")}`;
  } catch {
    return undefined;
  }
}

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
  const [services, otbFrom] = await Promise.all([getActiveServices(), otbStartingFrom()]);

  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <MotionReveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Everything TripNexio offers"
              title="Explore Our Services"
              description="Visa and travel services made simple, with a clear process and guided support from start to finish."
            />
            <Link
              href={headerActions.getStarted.href}
              className="flex items-center gap-1.5 text-sm font-medium text-ink-accent transition-colors duration-200 hover:text-ink-primary"
            >
              View All Services
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
                  ctaLabel={service.ctaLabel || service.name}
                  href={routeInfo.href}
                  image={routeInfo.image}
                  imageAlt={routeInfo.imageAlt}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                  startingFrom={service.code === "OTB" ? otbFrom : undefined}
                />
              </MotionReveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
