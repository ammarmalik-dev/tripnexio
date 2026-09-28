import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplyGate } from "@/components/apply/ApplyGate";
import { NewVisaRequestFlow } from "@/components/services/new-visa/NewVisaRequestFlow";

export const metadata: Metadata = {
  title: "Request New Visa",
  description: "Apply for your UAE visa online in a few guided steps.",
};

export default function NewVisaRequestPage() {
  return (
    <ApplyGate>
      <Suspense>
        <NewVisaRequestFlow />
      </Suspense>
    </ApplyGate>
  );
}
