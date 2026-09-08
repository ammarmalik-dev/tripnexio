import type { Metadata } from "next";
import { VisaExtensionRequestFlow } from "@/components/services/visa-extension/VisaExtensionRequestFlow";

export const metadata: Metadata = {
  title: "Request Visa Extension",
  description: "Extend an existing UAE visa originally issued through TripNexio in a few guided steps.",
};

export default function VisaExtensionRequestPage() {
  return <VisaExtensionRequestFlow />;
}
