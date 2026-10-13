import { describe, expect, it } from "vitest";
import { ctaFor, withoutLinkPlaceholder } from "../src/lib/notifications/cta";
import { tripFacts, tripSummaryLine } from "../src/lib/leads/trip-summary";

describe("notification buttons", () => {
  it("turns the payment link into a Pay Now button", () => {
    expect(ctaFor("PAYMENT_LINK_READY", { paymentLink: "https://tripnexio.com/pay/abc" })).toEqual({ label: "Pay Now", url: "https://tripnexio.com/pay/abc", variable: "paymentLink" });
    expect(ctaFor("PAYMENT_LINK_READY", {})).toBeNull();
    expect(ctaFor("PAYMENT_RECEIVED", { paymentLink: "https://tripnexio.com/pay/abc" })).toBeNull();
  });

  it("drops the link placeholder from an older template body", () => {
    expect(withoutLinkPlaceholder("Review and pay here: {{reviewLink}}", "reviewLink")).toBe("Review and pay");
    expect(withoutLinkPlaceholder("Complete your payment here: {{paymentLink}} (valid until {{x}}).", "paymentLink")).toBe("Complete your payment (valid until {{x}}).");
  });
});

describe("trip summary", () => {
  it("lists passengers, route and travel date for a flight", () => {
    const facts = tripFacts({
      serviceType: "FLIGHT_SPECIAL_FARE",
      paxCount: 2,
      travelDate: new Date("2026-10-20T00:00:00Z"),
      details: { origin: "Delhi - Indira Gandhi International Airport (DEL)", destination: "Dubai - Dubai International Airport (DXB)" },
      country: null,
    });
    expect(tripSummaryLine(facts)).toBe("Passengers: 2 · Route: Delhi → Dubai · Travel date: 20 Oct 2026");
  });

  it("uses the destination country when there is no route", () => {
    expect(tripSummaryLine(tripFacts({ serviceType: "RETURN_TICKET", paxCount: 1, travelDate: null, details: {}, country: { name: "Bahrain" } }))).toBe("Passengers: 1 · Destination: Bahrain");
  });
});
