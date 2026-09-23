export function serializeNewVisaPricing(row: {
  id: string;
  countryId: string;
  processingType: string;
  adultPrice: { toString(): string };
  childPrice: { toString(): string };
  infantPrice: { toString(): string };
  active: boolean;
  displayOrder: number;
  country: { name: string; code: string };
}) {
  return {
    id: row.id,
    countryId: row.countryId,
    countryName: row.country.name,
    countryCode: row.country.code,
    processingType: row.processingType,
    adultPrice: Number(row.adultPrice),
    childPrice: Number(row.childPrice),
    infantPrice: Number(row.infantPrice),
    active: row.active,
    displayOrder: row.displayOrder,
  };
}
