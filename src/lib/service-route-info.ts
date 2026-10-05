/**
 * Route/image facts for each locked service — deliberately kept as static
 * code, not Admin-editable (Step 6.2, client-locked-spec roadmap): a
 * service's URL is tied to an actual built page, and there's no image
 * upload feature, so neither is meaningfully "configurable" the way
 * name/description/icon/order/on-off are. Keyed by the same ServiceType
 * string values as Service.code so ServicesGrid can merge live Admin
 * metadata with these fixed facts.
 *
 * New Visa, Visa Extension, Return Ticket and OTB use the client's own photos (public/images/services/,
 * supplied 2026-10-03, resized for the web). Client correction 2026-10-05: Visa Change uses the Special
 * Fare airliner photo, and Special Fare takes the client's passport-and-map photo in its place.
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
    image: "/images/services/new-visa.jpg",
    imageAlt: "A passport and reading glasses on an open world atlas",
  },
  VISA_EXTENSION: {
    href: "/services/visa-extension",
    image: "/images/services/visa-extension.jpg",
    imageAlt: "A traveller completing an online application on a laptop, passport beside it",
  },
  VISA_CHANGE: {
    href: "/services/visa-change",
    image: "https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?auto=format&fit=crop&w=2400&q=85",
    imageAlt: "An airliner climbing through bright clouds",
  },
  FLIGHT_SPECIAL_FARE: {
    href: "/services/flight-special-fare",
    image: "/images/services/flight-special-fare.jpg",
    imageAlt: "Stamped passports, a watch and coins on a travel map",
  },
  RETURN_TICKET: {
    href: "/services/return-ticket",
    image: "/images/services/return-ticket.jpg",
    imageAlt: "A traveller checking her phone outside an airport terminal",
  },
  OTB: {
    href: "/services/otb",
    image: "/images/services/otb.jpg",
    imageAlt: "A departures board in a busy airport terminal",
  },
};
