import type { Metadata } from "next";
import { ApplyGate } from "@/components/apply/ApplyGate";
import { ReturnTicketRequestFlow } from "@/components/services/return-ticket/ReturnTicketRequestFlow";

export const metadata: Metadata = {
  title: "Request Return Verified Ticket",
  description: "Share your travel and expected return dates to reserve a Return Verified Ticket in a few guided steps.",
};

export default function ReturnTicketRequestPage() {
  return (
    <ApplyGate>
      <ReturnTicketRequestFlow />
    </ApplyGate>
  );
}
