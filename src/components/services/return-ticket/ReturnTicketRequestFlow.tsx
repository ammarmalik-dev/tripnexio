"use client";

import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1TripDetails } from "./steps/Step1TripDetails";
import { Step2Summary } from "./steps/Step2Summary";
import { submitReturnTicketRequest } from "@/lib/api/return-ticket";
import {
  returnTicketRequestSchema,
  returnTicketStepFields,
  returnTicketStepLabels,
  type ReturnTicketRequestValues,
} from "@/lib/validation/return-ticket-schema";

const steps = [Step1TripDetails, Step2Summary];

export function ReturnTicketRequestFlow() {
  return (
    <MultiStepRequestFlow<ReturnTicketRequestValues>
      eyebrow="Return Verified Ticket Request"
      title="Reserve Your Return Verified Ticket"
      schema={returnTicketRequestSchema}
      defaultValues={{
        fullName: "",
        mobile: "",
        email: "",
        visaType: undefined,
        travelDate: "",
        travelers: "1",
      }}
      stepFields={returnTicketStepFields}
      stepLabels={returnTicketStepLabels}
      steps={steps}
      onSubmit={submitReturnTicketRequest}
      successTitle="Request received"
      successDescription="Your Return Verified Ticket request has been received. Our team will confirm your reservation and get in touch shortly."
    />
  );
}
