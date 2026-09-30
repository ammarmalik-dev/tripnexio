/**
 * Route/image facts for each locked service — deliberately kept as static
 * code, not Admin-editable (Step 6.2, client-locked-spec roadmap): a
 * service's URL is tied to an actual built page, and there's no image
 * upload feature, so neither is meaningfully "configurable" the way
 * name/description/icon/order/on-off are. Keyed by the same ServiceType
 * string values as Service.code so ServicesGrid can merge live Admin
 * metadata with these fixed facts.
 *
 * Photography sourced from Unsplash (free to use under the Unsplash
 * License, no attribution required) — high-resolution (2400px) stock shots, also used full-bleed behind each service page's hero (ServiceHeroBackdrop);
 * swap for TripNexio's own branded photography when the client provides it.
 */
export interface ServiceRouteInfo {
  href: string;
  image: string;
  imageAlt: string;
}

export const SERVICE_ROUTE_INFO: Record<string, ServiceRouteInfo> = {
  NEW_VISA: {
    href: "/services/new-visa",
    image: "https://images.unsplash.com/photo-1517400508447-f8dd518b86db?auto=format&fit=crop&w=2400&q=85",
    imageAlt: "A traveller reading the departures board in an airport terminal",
  },
  VISA_EXTENSION: {
    href: "/services/visa-extension",
    image: "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=2400&q=85",
    imageAlt: "A relaxed traveller waiting in an airport lounge as a plane takes off",
  },
  VISA_CHANGE: {
    href: "/services/visa-change",
    image: "https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=2400&q=85",
    imageAlt: "An airliner coming in to land over a runway",
  },
  FLIGHT_SPECIAL_FARE: {
    href: "/services/flight-special-fare",
    image: "https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?auto=format&fit=crop&w=2400&q=85",
    imageAlt: "An airliner climbing through bright clouds",
  },
  RETURN_TICKET: {
    href: "/services/return-ticket",
    image: "https://images.unsplash.com/photo-1544016768-982d1554f0b9?auto=format&fit=crop&w=2400&q=85",
    imageAlt: "An airliner flying overhead against a soft evening sky",
  },
  OTB: {
    href: "/services/otb",
    image: "https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=2400&q=85",
    imageAlt: "An airliner parked at the gate at sunrise, ready for boarding",
  },
};
