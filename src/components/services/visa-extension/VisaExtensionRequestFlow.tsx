"use client";

import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1Identity } from "./steps/Step1Identity";
import { Step2Applicants } from "./steps/Step2Applicants";
import { Step3Summary } from "./steps/Step3Summary";
import { submitVisaExtensionRequest } from "@/lib/api/visa-extension";
import {
  visaExtensionRequestSchema,
  visaExtensionStepFields,
  visaExtensionStepLabels,
  type VisaExtensionRequestValues,
} from "@/lib/validation/visa-extension-schema";
import { requestReceivedMessage } from "@/lib/leads/request-received-message";

const steps = [Step1Identity, Step2Applicants, Step3Summary];

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
        visaExpiryDate: "",
        passportImageBase64: "",
        visaImageBase64: "",
        additionalApplicants: [],
      }}
      stepFields={visaExtensionStepFields}
      stepLabels={visaExtensionStepLabels}
      steps={steps}
      onSubmit={submitVisaExtensionRequest}
      draftServiceType="VISA_EXTENSION"
      successTitle="Request received"
      successDescription={requestReceivedMessage("VISA_EXTENSION")}
    />
  );
}
