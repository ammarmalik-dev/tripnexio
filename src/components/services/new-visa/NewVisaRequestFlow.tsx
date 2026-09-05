"use client";

import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1TravelDetails } from "./steps/Step1TravelDetails";
import { Step2ProcessingType } from "./steps/Step2ProcessingType";
import { Step3Summary } from "./steps/Step3Summary";
import { submitNewVisaRequest } from "@/lib/mock-api/new-visa";
import {
  newVisaRequestSchema,
  newVisaStepFields,
  newVisaStepLabels,
  type NewVisaRequestValues,
} from "@/lib/validation/new-visa-schema";

const steps = [Step1TravelDetails, Step2ProcessingType, Step3Summary];

export function NewVisaRequestFlow() {
  return (
    <MultiStepRequestFlow<NewVisaRequestValues>
      eyebrow="New Visa Request"
      title="Apply for a New Visa"
      schema={newVisaRequestSchema}
      defaultValues={{
        fullName: "",
        mobile: "",
        email: "",
        destinationCountry: "",
        visaType: "",
        travelers: "1",
        travelDate: "",
        processingType: undefined,
      }}
      stepFields={newVisaStepFields}
      stepLabels={newVisaStepLabels}
      steps={steps}
      onSubmit={submitNewVisaRequest}
      successTitle="Request submitted"
      successDescription="Your New Visa request has been received. Our team will review the details and get in touch shortly."
    />
  );
}
