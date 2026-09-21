"use client";

import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1Identity } from "./steps/Step1Identity";
import { Step2EntryDate } from "./steps/Step2EntryDate";
import { Step3Applicants } from "./steps/Step3Applicants";
import { Step4Summary } from "./steps/Step4Summary";
import { submitVisaExtensionRequest } from "@/lib/api/visa-extension";
import {
  visaExtensionRequestSchema,
  visaExtensionStepFields,
  visaExtensionStepLabels,
  type VisaExtensionRequestValues,
} from "@/lib/validation/visa-extension-schema";

const steps = [Step1Identity, Step2EntryDate, Step3Applicants, Step4Summary];

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
        passportImageBase64: "",
        additionalApplicants: [],
      }}
      stepFields={visaExtensionStepFields}
      stepLabels={visaExtensionStepLabels}
      steps={steps}
      onSubmit={submitVisaExtensionRequest}
      successTitle="Request received"
      successDescription="Your Visa Extension request has been received. Our team will validate each applicant's details and documents and get in touch shortly."
    />
  );
}
