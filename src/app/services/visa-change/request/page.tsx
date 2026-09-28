import type { Metadata } from "next";
import { ApplyGate } from "@/components/apply/ApplyGate";
import { VisaChangeRequestFlow } from "@/components/services/visa-change/VisaChangeRequestFlow";

export const metadata: Metadata = {
  title: "Request Visa Change",
  description: "Change your UAE visa status — Airport-to-Airport or Border Exit — in a few guided steps.",
};

export default function VisaChangeRequestPage() {
  return (
    <ApplyGate>
      <VisaChangeRequestFlow />
    </ApplyGate>
  );
}
