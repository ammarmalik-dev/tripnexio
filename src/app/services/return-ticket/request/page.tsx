import type { Metadata } from "next";
import { ReturnTicketRequestFlow } from "@/components/services/return-ticket/ReturnTicketRequestFlow";

export const metadata: Metadata = {
  title: "Request Return Verified Ticket",
  description: "Share your visa type and travel date to reserve a Return Verified Ticket in a few guided steps.",
};

export default function ReturnTicketRequestPage() {
  return <ReturnTicketRequestFlow />;
}
