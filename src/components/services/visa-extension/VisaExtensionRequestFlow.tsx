"use client";

import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1Identity } from "./steps/Step1Identity";
import { Step2EntryDate } from "./steps/Step2EntryDate";
import { Step3Summary } from "./steps/Step3Summary";
import { submitVisaExtensionRequest } from "@/lib/api/visa-extension";
import {
  visaExtensionRequestSchema,
  visaExtensionStepFields,
  visaExtensionStepLabels,
  type VisaExtensionRequestValues,
} from "@/lib/validation/visa-extension-schema";

const steps = [Step1Identity, Step2EntryDate, Step3Summary];

export function VisaExtensionRequestFlow() {
  return (
    <MultiStepRequestFlow<VisaExtensionRequestValues>
      eyebrow="Visa Extension Request"
      title="Extend Your UAE Visa"
      schema={visaExtensionRequestSchema}
      defaultValues={{
        fullName: "",
        mobile: "",
        email: "",
        passportNumber: "",
        dob: "",
        insideUAE: undefined,
        entryDate: "",
      }}
      stepFields={visaExtensionStepFields}
      stepLabels={visaExtensionStepLabels}
      steps={steps}
      onSubmit={submitVisaExtensionRequest}
      successTitle="Request received"
      successDescription="Your Visa Extension request has been received. Our team will verify your visa details and get in touch shortly."
    />
  );
}
