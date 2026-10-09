"use client";

import { MultiStepRequestFlow } from "@/components/forms/MultiStepRequestFlow";
import { Step1TripDetails } from "./steps/Step1TripDetails";
import { Step2Passengers } from "./steps/Step2Passengers";
import { Step3Summary } from "./steps/Step3Summary";
import { submitFlightSpecialFareRequest } from "@/lib/api/flight-special-fare";
import {
  flightSpecialFareRequestSchema,
  flightSpecialFareStepFields,
  flightSpecialFareStepLabels,
  type FlightSpecialFareRequestValues,
} from "@/lib/validation/flight-special-fare-schema";
import { requestReceivedMessage } from "@/lib/leads/request-received-message";

const steps = [Step1TripDetails, Step2Passengers, Step3Summary];

export function FlightSpecialFareRequestFlow() {
  return (
    <MultiStepRequestFlow<FlightSpecialFareRequestValues>
      eyebrow="Flight Special Fare Request"
      title="Get a Special Fare Quote"
      schema={flightSpecialFareRequestSchema}
      defaultValues={{
        fullName: "",
        mobile: "",
        email: "",
        origin: "",
        destination: "",
        travelDate: "",
        returnDate: "",
        passengers: [{ fullName: "", dob: "", savedPassengerId: "", reusePassport: "" }],
      }}
      stepFields={flightSpecialFareStepFields}
      stepLabels={flightSpecialFareStepLabels}
      steps={steps}
      onSubmit={submitFlightSpecialFareRequest}
      draftServiceType="FLIGHT_SPECIAL_FARE"
      successTitle="Request received"
      successDescription={requestReceivedMessage("FLIGHT_SPECIAL_FARE")}
    />
  );
}
