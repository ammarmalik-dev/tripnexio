import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format-currency";
import { getSystemConfig } from "@/lib/settings/system-config";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

interface ExtensionOption {
  id: string;
  name: string;
  description: string | null;
  /** Lowest active Adult price (sellingPrice + additionalCharges); null = priced on the quotation. */
  fromPrice: number | null;
}

/**
 * Visa Extension handover §1 (client 2026-10-25 "everything in the docs") — the extension options on cards, as on New
 * Visa: each Admin sub-service of Visa Extension (Admin → Service Configuration → Sub-services; its description is the
 * validity / term text) with its "from" price from the central Pricing control. Vendor cost is never read. Nothing
 * configured = the section is left out; a DB hiccup never breaks the page.
 */
async function loadExtensionOptions(): Promise<ExtensionOption[]> {
  try {
    const now = new Date();
    const [subServices, rules] = [
      await db.subService.findMany({
        where: { serviceType: "VISA_EXTENSION", active: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, description: true },
      }),
      await db.pricingRule.findMany({
        where: {
          serviceType: "VISA_EXTENSION",
          paxType: "ADULT",
          active: true,
          AND: [
            { OR: [{ validityFrom: null }, { validityFrom: { lte: now } }] },
            { OR: [{ validityUntil: null }, { validityUntil: { gte: now } }] },
          ],
        },
        select: { subServiceId: true, sellingPrice: true, additionalCharges: true },
      }),
    ];
    const lowest = (subServiceId: string | null) => {
      const prices = rules.filter((rule) => rule.subServiceId === subServiceId).map((rule) => Number(rule.sellingPrice) + Number(rule.additionalCharges));
      return prices.length ? Math.min(...prices) : null;
    };
    if (subServices.length > 0) return subServices.map((option) => ({ ...option, fromPrice: lowest(option.id) ?? lowest(null) }));
    // No sub-services yet: one card for the service-wide price, when there is one.
    const general = lowest(null);
    return general === null ? [] : [{ id: "general", name: "UAE Visa Extension", description: null, fromPrice: general }];
  } catch (error) {
    console.error("[visa-extension] couldn't load extension options", error);
    return [];
  }
}

export async function ExtensionOptionCards({ content }: { content: SitePageContentView }) {
  const options = await loadExtensionOptions();
  if (options.length === 0) return null;
  const currency = (await getSystemConfig()).currencyCode;

  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading align="center" eyebrow={content.text("options.eyebrow")} title={content.text("options.heading")} description={content.text("options.intro")} className="mx-auto" />
        </MotionReveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option, index) => (
            <MotionReveal key={option.id} delay={index * 0.05} className="h-full">
              <GlassCard className="flex h-full flex-col gap-4 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <CalendarClock className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-semibold text-ink-heading">{option.name}</h3>
                  {option.description ? <p className="whitespace-pre-line text-sm text-ink-secondary">{option.description}</p> : null}
                </div>
                <p className="text-sm text-ink-secondary">
                  {option.fromPrice !== null ? (
                    <>
                      {content.text("options.fromLabel")} <span className="text-xl font-semibold text-ink-heading">{formatCurrency(option.fromPrice, currency)}</span>
                    </>
                  ) : (
                    content.text("options.quoteLabel")
                  )}
                </p>
                <p className="text-xs text-ink-tertiary">
                  {content.text("options.note")}{" "}
                  <Link href="/legal/terms" className="font-medium text-ink-accent hover:underline">
                    {content.text("options.termsLabel")}
                  </Link>
                </p>
                <ButtonLink href="/services/visa-extension/request" variant="primary" size="md" className="mt-auto justify-center">
                  {content.text("applyLabel")}
                </ButtonLink>
              </GlassCard>
            </MotionReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
