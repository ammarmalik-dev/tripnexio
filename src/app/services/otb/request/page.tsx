import type { Metadata } from "next";
import { OtbRequestFlow } from "@/components/services/otb/OtbRequestFlow";

export const metadata: Metadata = {
  title: "Request OTB",
  description: "Submit your Ok to Board (OTB) request in a few guided steps.",
};

export default function OtbRequestPage() {
  return <OtbRequestFlow />;
}
