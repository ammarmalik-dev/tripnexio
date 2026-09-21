import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { CheckoutPanel } from "@/components/checkout/CheckoutPanel";

export const metadata: Metadata = {
  title: "Complete Your Payment",
  description: "Pay for your TripNexio request and upload your documents.",
  // Private, token-gated page — keep it out of search results.
  robots: { index: false, follow: false },
};

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <CheckoutPanel token={token} />
      </div>
    </Container>
  );
}
