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
 * License, no attribution required) — placeholder-quality stock shots;
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
    image: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "A commercial aircraft parked at an airport terminal gate",
  },
  VISA_EXTENSION: {
    href: "/services/visa-extension",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "A flat lay of travel planning essentials — map, notebook and camera",
  },
  VISA_CHANGE: {
    href: "/services/visa-change",
    image: "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "View of an airplane wing above clouds at sunset",
  },
  FLIGHT_SPECIAL_FARE: {
    href: "/services/flight-special-fare",
    image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "View of an airplane wing above clouds, backlit by the sun",
  },
  RETURN_TICKET: {
    href: "/services/return-verified-ticket",
    image: "https://images.unsplash.com/photo-1540339832862-474599807836?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Interior of an airplane cabin with passengers seated",
  },
  OTB: {
    href: "/services/otb",
    image: "https://images.unsplash.com/photo-1533387520709-752d83de3630?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Sunset over layered mountain ridges with a jet contrail overhead",
  },
};
