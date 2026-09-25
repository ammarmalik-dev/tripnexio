import type { Metadata } from "next";
import { Suspense } from "react";
import { NewVisaRequestFlow } from "@/components/services/new-visa/NewVisaRequestFlow";

export const metadata: Metadata = {
  title: "Request New Visa",
  description: "Apply for a new UAE or GCC visa in a few guided steps.",
};

export default function NewVisaRequestPage() {
  return (
    <Suspense>
      <NewVisaRequestFlow />
    </Suspense>
  );
}
