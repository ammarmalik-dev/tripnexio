export function serializeDestination(d: {
  id: string;
  countryId: string;
  ratePerApplicant: { toString(): string };
  cancellationFee: { toString(): string } | null;
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
    cancellationFee: d.cancellationFee === null ? null : Number(d.cancellationFee),
    active: d.active,
    displayOrder: d.displayOrder,
  };
}
