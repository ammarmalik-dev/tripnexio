import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { QuoteReviewPanel } from "@/components/quote-review/QuoteReviewPanel";

export const metadata: Metadata = {
  title: "Review Your Quote",
  description: "Review and approve your TripNexio quote.",
  robots: { index: false, follow: false },
};

export default async function QuoteReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <QuoteReviewPanel token={token} />
      </div>
    </Container>
  );
}
