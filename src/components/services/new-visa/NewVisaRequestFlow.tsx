"use client";

import { useSearchParams } from "next/navigation";
import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1TravelDetails } from "./steps/Step1TravelDetails";
import { StepTravellers } from "./steps/StepTravellers";
import { Step2ProcessingType } from "./steps/Step2ProcessingType";
import { Step3Summary } from "./steps/Step3Summary";
import { submitNewVisaRequest } from "@/lib/api/new-visa";
import {
  findNewVisaStep1Issues,
  findNewVisaTravellerIssues,
  newVisaRequestSchema,
  newVisaStepFields,
  newVisaStepLabels,
  type NewVisaRequestValues,
} from "@/lib/validation/new-visa-schema";

const steps = [Step1TravelDetails, StepTravellers, Step2ProcessingType, Step3Summary];

/**
 * Pre-fills from the New Visa landing page's product-selector "Apply Now"
 * link (`NewVisaProductSelector.tsx`) — country/processing-type/traveller
 * count only, since that's all the selector collects; every other field
 * (name, DOB, passport, etc.) still needs the customer's real input here.
 * A direct visit with no query params behaves exactly as before.
 */
function useNewVisaPrefill(): {
  country: string;
  config: string;
  visaType: string;
  processingType: "normal" | "urgent" | undefined;
  travelers: string;
} {
  const searchParams = useSearchParams();
  const country = searchParams.get("country") ?? "";
  // P10 — the product chosen on the landing page's selector; step 1 clears it if it isn't offered for the country.
  const config = searchParams.get("config") ?? "";
  // From the WhatsApp bot's hand-over link; step 1 clears it if it isn't offered for the country.
  const visaType = searchParams.get("visaType") ?? "";
  const processingTypeParam = searchParams.get("processingType");
  const travelersParam = searchParams.get("travelers");
  const processingType = processingTypeParam === "normal" || processingTypeParam === "urgent" ? processingTypeParam : undefined;
  const travelersCount = Number(travelersParam);
  const travelers = travelersParam && Number.isInteger(travelersCount) && travelersCount >= 1 && travelersCount <= 9 ? travelersParam : "1";
  return { country, config, visaType, processingType, travelers };
}

export function NewVisaRequestFlow() {
  const prefill = useNewVisaPrefill();

  return (
    <MultiStepRequestFlow<NewVisaRequestValues>
      eyebrow="New Visa Request"
      title="Apply for a New Visa"
      schema={newVisaRequestSchema}
      defaultValues={{
        fullName: "",
        mobile: "",
        email: "",
        destinationCountry: prefill.country,
        visaType: prefill.visaType,
        visaTypeRequired: false,
        newVisaConfigId: prefill.config,
        visaOptionRequired: false,
        travelers: prefill.travelers,
        travelDate: "",
        passportNumber: "",
        dob: "",
        occupation: "",
        passportExpiry: "",
        passportImageBase64: "",
        additionalTravellers: [],
        processingType: prefill.processingType,
        protectionPlanInterested: false,
        protectionPlanTermsAccepted: false,
      }}
      stepFields={newVisaStepFields}
      stepLabels={newVisaStepLabels}
      steps={steps}
      extraStepValidation={{ 0: findNewVisaStep1Issues, 1: findNewVisaTravellerIssues }}
      onSubmit={submitNewVisaRequest}
      successTitle="Request submitted"
      successDescription="Your New Visa request has been received. Our team will review the details and get in touch shortly."
    />
  );
}
