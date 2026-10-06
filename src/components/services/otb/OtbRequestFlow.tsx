"use client";

import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1BasicDetails } from "./steps/Step1BasicDetails";
import { StepApplicants } from "./steps/StepApplicants";
import { Step3Summary } from "./steps/Step3Summary";
import { submitOtbRequest } from "@/lib/api/otb";
import {
  otbRequestSchema,
  otbStepFields,
  otbStepLabels,
  type OtbRequestValues,
} from "@/lib/validation/otb-schema";

const steps = [Step1BasicDetails, StepApplicants, Step3Summary];

export function OtbRequestFlow() {
  return (
    <MultiStepRequestFlow<OtbRequestValues>
      eyebrow="OTB Request"
      title="Request Ok to Board"
      schema={otbRequestSchema}
      defaultValues={{
        fullName: "",
        mobile: "",
        email: "",
        passportNumber: "",
        paxType: "ADULT",
        destinationCountry: "",
        airline: "",
        travelDate: "",
        processingType: undefined,
        additionalApplicants: [],
        hasReturnTicket: undefined,
        addReturnTicket: undefined,
        returnDestinationCountryId: "",
        expectedReturnDate: "",
      }}
      stepFields={otbStepFields}
      stepLabels={otbStepLabels}
      steps={steps}
      onSubmit={submitOtbRequest}
      draftServiceType="OTB"
      successTitle="Request submitted"
      successDescription="Your OTB request has been received. Our team will verify the details and get in touch shortly."
    />
  );
}
