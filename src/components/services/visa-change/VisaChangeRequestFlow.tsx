"use client";

import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1Method } from "./steps/Step1Method";
import { Step2Details } from "./steps/Step2Details";
import { Step3DocumentChecklist } from "./steps/Step3DocumentChecklist";
import { Step4Summary } from "./steps/Step4Summary";
import { submitVisaChangeRequest } from "@/lib/api/visa-change";
import {
  findMissingApplicantDocuments,
  visaChangeRequestSchema,
  visaChangeStepFields,
  visaChangeStepLabels,
  type VisaChangeRequestValues,
} from "@/lib/validation/visa-change-schema";

const steps = [Step1Method, Step2Details, Step3DocumentChecklist, Step4Summary];

export function VisaChangeRequestFlow() {
  return (
    <MultiStepRequestFlow<VisaChangeRequestValues>
      eyebrow="Visa Change Request"
      title="Change Your UAE Visa"
      schema={visaChangeRequestSchema}
      defaultValues={{
        changeType: undefined,
        fullName: "",
        passportNumber: "",
        visaLastDate: "",
        mobile: "",
        email: "",
        nationality: "",
        paxType: "ADULT",
        additionalPassengers: [],
      }}
      stepFields={visaChangeStepFields}
      stepLabels={visaChangeStepLabels}
      steps={steps}
      extraStepValidation={{ 2: findMissingApplicantDocuments }}
      onSubmit={submitVisaChangeRequest}
      successTitle="Request received"
      successDescription="Your Visa Change request has been received. Our team will check availability and get in touch shortly."
    />
  );
}
