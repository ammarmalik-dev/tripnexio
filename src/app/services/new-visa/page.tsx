import type { Metadata } from "next";
import { FileText, MessageCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { ServiceHeroBackdrop } from "@/components/services/ServiceHeroBackdrop";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { siteConfig } from "@/lib/site-config";
import { NewVisaCountryGrid } from "@/components/services/new-visa/NewVisaCountryGrid";
import { getPublishedCountryCards, type CountryPageCard } from "@/lib/new-visa/country-pages";

// Destinations, prices and content are Admin-managed; refresh without a redeploy.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "New Visa â€” Choose your destination",
  description:
    "Apply for a new visa online with TripNexio. Choose your destination, see the price, and let us guide you from application to completion.",
};

async function loadCards(): Promise<CountryPageCard[] | null> {
  try {
    return await getPublishedCountryCards();
  } catch (error) {
    console.error("[new-visa] couldn't load destinations", error);
    return null;
  }
}

/** /services/new-visa â€” a card per destination with a published page (Admin â†’ New Visa Country Pages). */
export default async function NewVisaDestinationsPage() {
  const cards = await loadCards();

  return (
    <>
      <section className="relative overflow-hidden">
        <ServiceHeroBackdrop service="NEW_VISA" />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-24">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">New Visa</span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">Where are you travelling?</h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Choose your destination to see visa options, prices and the documents you&rsquo;ll need. Apply online and TripNexio guides
              you from application to completion.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
              Track Application
            </ButtonLink>
          </MotionReveal>
        </Container>
      </section>

      <section className="pb-20 pt-4 sm:pb-28">
        <Container className="flex flex-col gap-10">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Destinations" title="Pick a country to get started" className="mx-auto" />
          </MotionReveal>

          {cards === null ? (
            <EmptyState
              title="Destinations couldn't load"
              description="Please refresh the page in a moment, or message us on WhatsApp and we'll help you apply."
              action={
                <ButtonLink href={siteConfig.contact.whatsappHref} variant="primary" size="sm">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp Support
                </ButtonLink>
              }
            />
          ) : cards.length === 0 ? (
            <EmptyState
              title="Destinations coming soon"
              description="We're adding visa destinations. Message us on WhatsApp and we'll help with your visa in the meantime."
              action={
                <ButtonLink href={siteConfig.contact.whatsappHref} variant="primary" size="sm">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp Support
                </ButtonLink>
              }
            />
          ) : (
            <NewVisaCountryGrid cards={cards} />
          )}
        </Container>
      </section>
    </>
  );
}
