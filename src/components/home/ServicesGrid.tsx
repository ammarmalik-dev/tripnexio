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
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";

const FALLBACK_ICONS: Record<string, string> = {
  NEW_VISA: "FileText",
  VISA_EXTENSION: "CalendarClock",
  VISA_CHANGE: "ArrowLeftRight",
  FLIGHT_SPECIAL_FARE: "Plane",
  RETURN_TICKET: "TicketCheck",
  OTB: "PlaneTakeoff",
};

/**
 * P20 — never let a dropped DB connection fail the homepage/services page
 * (or the build's static generation): fall back to the six locked services
 * from static route info, without Admin names/descriptions.
 */
async function loadServicesSafely() {
  try {
    return await getActiveServices();
  } catch (error) {
    console.error("[ServicesGrid] couldn't load services, using the static list", error);
    return Object.keys(SERVICE_ROUTE_INFO).map((code, index) => ({
      id: code,
      code,
      name: SERVICE_TYPE_LABELS[code as keyof typeof SERVICE_TYPE_LABELS] ?? code,
      shortDescription: "",
      ctaLabel: "Learn more",
      iconName: FALLBACK_ICONS[code] ?? "PlaneTakeoff",
      displayOrder: index,
    }));
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
  // No prices on the service cards (client correction 2026-10-05).
  const services = await loadServicesSafely();

  return (
    <section className="py-14 sm:py-20">
      <Container className="flex flex-col gap-10">
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
                />
              </MotionReveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
