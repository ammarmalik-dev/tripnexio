import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { FaqExplorer, type FaqExplorerItem } from "@/components/faq/FaqExplorer";
import { db } from "@/lib/db";
import { getSiteContact } from "@/lib/settings/system-config";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { ServiceType } from "@/generated/prisma/enums";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about TripNexio visa and flight services — search by service or country.",
};

// Admin edits FAQs at runtime — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

const SERVICE_ORDER: ServiceType[] = ["NEW_VISA", "VISA_EXTENSION", "VISA_CHANGE", "FLIGHT_SPECIAL_FARE", "RETURN_TICKET", "OTB"];
const GENERAL = "GENERAL";

interface FaqPageProps {
  searchParams: Promise<{ service?: string; country?: string; q?: string }>;
}

/**
 * Client 2026-10-25 — every published FAQ (general, each service, each New Visa country) in one place, searchable
 * by service or country. Service pages still show their own FAQs.
 */
export default async function FaqPage({ searchParams }: FaqPageProps) {
  const [contact, params] = await Promise.all([getSiteContact(), searchParams]);
  // P20 — a DB hiccup shows the friendly empty state rather than an error page.
  const faqs = await db.faq
    .findMany({
      where: { active: true, published: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, question: true, answer: true, serviceType: true, keywords: true, country: { select: { code: true, name: true } } },
    })
    .catch((error: unknown) => {
      console.error("[faq] couldn't load FAQs", error);
      return [];
    });

  const rank = (topic: string) => (topic === GENERAL ? -1 : SERVICE_ORDER.indexOf(topic as ServiceType));
  const items: FaqExplorerItem[] = faqs
    .map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      topic: faq.serviceType ?? GENERAL,
      topicLabel: faq.serviceType ? SERVICE_TYPE_LABELS[faq.serviceType] : "General",
      countryCode: faq.country?.code ?? null,
      countryName: faq.country?.name ?? null,
      keywords: faq.keywords,
    }))
    // Stable: general first, then services in menu order, country FAQs after their service's own.
    .sort((a, b) => rank(a.topic) - rank(b.topic) || Number(!!a.countryName) - Number(!!b.countryName) || (a.countryName ?? "").localeCompare(b.countryName ?? ""));

  const topics = [...new Set(items.map((item) => item.topic))].map((value) => ({ value, label: value === GENERAL ? "General" : SERVICE_TYPE_LABELS[value as ServiceType] }));
  const countries = [...new Map(items.filter((item) => item.countryCode).map((item) => [item.countryCode as string, item.countryName as string])).entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const initialTopic = params.service && topics.some((topic) => topic.value === params.service?.toUpperCase()) ? params.service.toUpperCase() : "";
  const initialCountry = params.country ? (countries.find((option) => option.code.toLowerCase() === params.country?.toLowerCase())?.code ?? "") : "";

  return (
    <InfoPage eyebrow="Help" title="Frequently asked questions" description="Search by service or country, or type your question.">
      {items.length === 0 ? (
        <EmptyState
          title="No FAQs published yet"
          description="We're still putting these together. In the meantime our team is happy to help on WhatsApp."
          action={<ButtonLink href={contact.whatsappHref}>WhatsApp Support</ButtonLink>}
        />
      ) : (
        <FaqExplorer items={items} topics={topics} countries={countries} initial={{ q: (params.q ?? "").slice(0, 100), topic: initialTopic, country: initialCountry }} />
      )}
    </InfoPage>
  );
}
