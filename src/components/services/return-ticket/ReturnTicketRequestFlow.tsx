"use client";

import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1TripDetails } from "./steps/Step1TripDetails";
import { Step2Applicants } from "./steps/Step2Applicants";
import { Step3Summary } from "./steps/Step3Summary";
import { submitReturnTicketRequest } from "@/lib/api/return-ticket";
import {
  returnTicketRequestSchema,
  returnTicketStepFields,
  returnTicketStepLabels,
  type ReturnTicketRequestValues,
} from "@/lib/validation/return-ticket-schema";
import { requestReceivedMessage } from "@/lib/leads/request-received-message";

const steps = [Step1TripDetails, Step2Applicants, Step3Summary];

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
        passportNumber: "",
        destinationCountryId: "",
        travelDate: "",
        expectedReturnDate: "",
        additionalApplicants: [],
      }}
      stepFields={returnTicketStepFields}
      stepLabels={returnTicketStepLabels}
      steps={steps}
      onSubmit={submitReturnTicketRequest}
      draftServiceType="RETURN_TICKET"
      successTitle="Request received"
      successDescription={requestReceivedMessage("RETURN_TICKET")}
    />
  );
}
