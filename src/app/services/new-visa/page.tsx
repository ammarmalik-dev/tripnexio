import type { Metadata } from "next";
import { FileText, MessageCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { ServiceHeroBackdrop } from "@/components/services/ServiceHeroBackdrop";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { getSiteContact } from "@/lib/settings/system-config";
import { NewVisaCountryGrid } from "@/components/services/new-visa/NewVisaCountryGrid";
import { getPublishedCountryCards, type CountryPageCard } from "@/lib/new-visa/country-pages";

// Destinations, prices and content are Admin-managed; refresh without a redeploy.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "New Visa — Choose your destination",
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

/** /services/new-visa — a card per destination with a published page (Admin → New Visa Country Pages). */
export default async function NewVisaDestinationsPage() {
  const cards = await loadCards();
  const contact = await getSiteContact();

  return (
    <>
      <section className="relative overflow-hidden">
        <ServiceHeroBackdrop service="NEW_VISA" />
        <Container className="relative flex flex-col items-center gap-5 py-12 text-center sm:py-16">
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
            <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <ButtonLink href="#destinations" variant="primary" size="lg">
                Explore Destinations
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                Track Status
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section id="destinations" className="scroll-mt-20 pb-14 pt-2 sm:pb-20">
        <Container className="flex flex-col gap-6">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Destinations" title="Pick a country to get started" className="mx-auto" />
          </MotionReveal>

          {cards === null ? (
            <EmptyState
              title="Destinations couldn't load"
              description="Please refresh the page in a moment, or message us on WhatsApp and we'll help you apply."
              action={
                <ButtonLink href={contact.whatsappHref} variant="primary" size="sm">
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
                <ButtonLink href={contact.whatsappHref} variant="primary" size="sm">
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
