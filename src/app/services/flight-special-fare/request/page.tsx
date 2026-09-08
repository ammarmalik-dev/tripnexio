import type { Metadata } from "next";
import { FlightSpecialFareRequestFlow } from "@/components/services/flight-special-fare/FlightSpecialFareRequestFlow";

export const metadata: Metadata = {
  title: "Request Flight Special Fare",
  description: "Share your route, travel date, and passengers to get a special fare quote in a few guided steps.",
};

export default function FlightSpecialFareRequestPage() {
  return <FlightSpecialFareRequestFlow />;
}
