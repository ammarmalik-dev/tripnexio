import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Careers",
  description: "Work with TripNexio.",
};

export default function CareersPage() {
  return (
    <InfoPage eyebrow="Careers" title="Work with TripNexio" description="We're a small team building connected travel services.">
      <EmptyState
        title="No open positions right now"
        description={`We don't have any roles listed at the moment. If you'd still like to introduce yourself, email ${siteConfig.contact.email}.`}
        action={<ButtonLink href={siteConfig.contact.emailHref}>Email us</ButtonLink>}
      />
    </InfoPage>
  );
}
