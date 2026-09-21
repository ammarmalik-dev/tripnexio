import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = {
  title: "Blog",
  description: "Travel and visa updates from TripNexio.",
};

export default function BlogPage() {
  return (
    <InfoPage eyebrow="Blog" title="Travel & visa updates" description="Guides and news for travellers heading to the UAE and Middle East.">
      <EmptyState
        title="No articles yet"
        description="We haven't published any posts yet. Check back soon, or browse our services."
        action={<ButtonLink href="/services">Browse Services</ButtonLink>}
      />
    </InfoPage>
  );
}
