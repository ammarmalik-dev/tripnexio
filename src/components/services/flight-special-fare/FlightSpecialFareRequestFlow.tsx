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
        passengers: [{ fullName: "", dob: "" }],
      }}
      stepFields={flightSpecialFareStepFields}
      stepLabels={flightSpecialFareStepLabels}
      steps={steps}
      onSubmit={submitFlightSpecialFareRequest}
      successTitle="Request received"
      successDescription="Your Flight Special Fare request has been received. Our team will check available fares and get in touch shortly."
    />
  );
}
