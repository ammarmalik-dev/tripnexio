export interface SelectOption {
  value: string;
  label: string;
}

// SAMPLE_AIRLINE_OPTIONS and SAMPLE_VISA_TYPE_OPTIONS removed (P06): airlines
// come from the Admin Airline master and visa types from the VisaType master.
//
// DESTINATION_COUNTRY_OPTIONS removed (Step 6.1, client-locked-spec
// roadmap) — destination countries are now fetched live from the real
// Admin-managed Country table via the public /api/countries endpoint
// (src/lib/use-destination-countries.ts), not a hardcoded array, since the
// client wants to be able to add a country without a code deployment.
