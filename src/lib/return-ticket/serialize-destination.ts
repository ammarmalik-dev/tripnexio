export function serializeDestination(d: {
  id: string;
  countryId: string;
  ratePerApplicant: { toString(): string };
  validityOptions: string[];
  active: boolean;
  displayOrder: number;
  country: { name: string; code: string };
}) {
  return {
    id: d.id,
    countryId: d.countryId,
    countryName: d.country.name,
    countryCode: d.country.code,
    ratePerApplicant: Number(d.ratePerApplicant),
    validityOptions: d.validityOptions,
    active: d.active,
    displayOrder: d.displayOrder,
  };
}
