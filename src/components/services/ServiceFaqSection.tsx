import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { db } from "@/lib/db";
import type { ServiceType } from "../../generated/prisma/enums";
import { ServiceFaqAccordion, type ServiceFaqItem } from "./ServiceFaqAccordion";

async function loadServiceFaqs(serviceType: ServiceType, countryId?: string): Promise<ServiceFaqItem[]> {
  try {
    const faqs = await db.faq.findMany({
      // A country page shows that country's FAQs plus the service's general
      // ones (no country); a plain service page shows only the general ones.
      where: {
        serviceType,
        active: true,
        published: true,
        ...(countryId ? { OR: [{ countryId }, { countryId: null }] } : { countryId: null }),
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, question: true, answer: true },
    });
    return faqs;
  } catch (error) {
    // Never take the service page down over its FAQ block.
    console.error("[service-faq] couldn't load FAQs", error);
    return [];
  }
}

/**
 * P19 — the FAQ block every service landing page ends with: the Admin-
 * managed Faq rows for that service (active + published, Admin order).
 * Renders nothing when a service has no published FAQ yet.
 */
export async function ServiceFaqSection({
  serviceType,
  countryId,
  title = "Frequently asked questions",
}: {
  serviceType: ServiceType;
  /** New Visa country pages: include FAQs tied to this country. */
  countryId?: string;
  title?: string;
}) {
  const items = await loadServiceFaqs(serviceType, countryId);
  if (items.length === 0) return null;
  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading align="center" eyebrow="FAQ" title={title} className="mx-auto" />
        </MotionReveal>
        <ServiceFaqAccordion items={items} />
      </Container>
    </section>
  );
}
