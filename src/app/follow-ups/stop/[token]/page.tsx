import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StopFollowUpsPanel } from "@/components/follow-ups/StopFollowUpsPanel";

export const metadata: Metadata = {
  title: "Stop Reminders",
  description: "Stop follow-up reminders for your TripNexio request.",
  robots: { index: false, follow: false },
};

export default async function StopFollowUpsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-xl">
        <StopFollowUpsPanel token={token} />
      </div>
    </Container>
  );
}
