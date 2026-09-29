import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { db } from "@/lib/db";
import type { ServiceType } from "../../generated/prisma/enums";
import { ServiceFaqAccordion, type ServiceFaqItem } from "./ServiceFaqAccordion";

async function loadServiceFaqs(serviceType: ServiceType): Promise<ServiceFaqItem[]> {
  try {
    const faqs = await db.faq.findMany({
      where: { serviceType, active: true, published: true },
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
export async function ServiceFaqSection({ serviceType, title = "Frequently asked questions" }: { serviceType: ServiceType; title?: string }) {
  const items = await loadServiceFaqs(serviceType);
  if (items.length === 0) return null;
  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading align="center" eyebrow="FAQ" title={title} className="mx-auto" />
        </MotionReveal>
        <ServiceFaqAccordion items={items} />
      </Container>
    </section>
  );
}
