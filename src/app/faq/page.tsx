import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { db } from "@/lib/db";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about TripNexio visa and flight services.",
};

// Admin edits FAQs at runtime — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const faqs = await db.faq.findMany({
    where: { active: true, published: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  const groups = new Map<string, typeof faqs>();
  for (const faq of faqs) {
    const key = faq.category?.trim() || "General";
    groups.set(key, [...(groups.get(key) ?? []), faq]);
  }

  return (
    <InfoPage eyebrow="Help" title="Frequently asked questions" description="Quick answers to the things customers ask us most.">
      {faqs.length === 0 ? (
        <EmptyState
          title="No FAQs published yet"
          description="We're still putting these together. In the meantime our team is happy to help on WhatsApp."
          action={<ButtonLink href={siteConfig.contact.whatsappHref}>WhatsApp Support</ButtonLink>}
        />
      ) : (
        Array.from(groups.entries()).map(([category, items]) => (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink-heading">{category}</h2>
            {items.map((faq) => (
              <details key={faq.id} className="group rounded-xl border border-hairline bg-surface-1 px-5 py-4">
                <summary className="cursor-pointer text-sm font-medium text-ink-primary marker:content-none">
                  {faq.question}
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-secondary">{faq.answer}</p>
              </details>
            ))}
          </section>
        ))
      )}
    </InfoPage>
  );
}
