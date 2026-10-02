import { db } from "../db";
import { computeNewVisaPrice } from "./pricing";
import { countryFlagEmoji } from "../countries/flag";
import type { NewVisaCountryPage } from "../../generated/prisma/client";

/** Public URL of an uploaded card/hero image (served by /api/new-visa-pages/image/[fileId]). */
export function countryPageImageUrl(fileId: string | null | undefined): string | null {
  return fileId ? `/api/new-visa-pages/image/${encodeURIComponent(fileId)}` : null;
}

/** The New Visa apply form, opened with this country already selected. */
export function newVisaApplyHref(countryCode: string): string {
  return `/services/new-visa/request?country=${encodeURIComponent(countryCode)}`;
}

/**
 * Lowest one-adult, Normal-processing price across the country's active
 * products, the same "from" price the product selector shows. Null when no
 * price is configured (never a guessed number).
 */
async function fromPriceForCountry(countryCode: string, countryId: string): Promise<number | null> {
  const configs = await db.newVisaCountryConfig.findMany({ where: { countryId, active: true }, select: { id: true } });
  let lowest: number | null = null;
  for (const config of configs) {
    const price = await computeNewVisaPrice({
      countryCode,
      newVisaConfigId: config.id,
      processingType: "normal",
      travellerPaxTypes: ["ADULT"],
    });
    if (price?.total != null && (lowest === null || price.total < lowest)) lowest = price.total;
  }
  return lowest;
}

export interface CountryPageCard {
  slug: string;
  countryCode: string;
  countryName: string;
  flag: string | null;
  tagline: string | null;
  imageUrl: string | null;
  fromPrice: number | null;
}

/** Published pages of active countries, for the /services/new-visa listing. */
export async function getPublishedCountryCards(): Promise<CountryPageCard[]> {
  const pages = await db.newVisaCountryPage.findMany({
    where: { published: true, country: { active: true } },
    orderBy: [{ displayOrder: "asc" }, { country: { name: "asc" } }],
    include: { country: { select: { id: true, code: true, name: true, flagOverride: true } } },
  });
  const cards: CountryPageCard[] = [];
  // One country at a time: each price lookup runs a few queries.
  for (const page of pages) {
    cards.push({
      slug: page.slug,
      countryCode: page.country.code,
      countryName: page.country.name,
      flag: countryFlagEmoji(page.country),
      tagline: page.cardTagline,
      imageUrl: countryPageImageUrl(page.cardImageFileId ?? page.heroImageFileId),
      fromPrice: await fromPriceForCountry(page.country.code, page.country.id),
    });
  }
  return cards;
}

export type PublishedCountryPage = NewVisaCountryPage & {
  country: { id: string; code: string; name: string; flagOverride: string | null };
};

/** A published page by its slug, or null (unpublished, unknown, or the country is inactive). */
export async function getPublishedCountryPage(slug: string): Promise<PublishedCountryPage | null> {
  return db.newVisaCountryPage.findFirst({
    where: { slug, published: true, country: { active: true } },
    include: { country: { select: { id: true, code: true, name: true, flagOverride: true } } },
  });
}

/** Slugs for the sitemap. */
export async function getPublishedCountrySlugs(): Promise<string[]> {
  const pages = await db.newVisaCountryPage.findMany({
    where: { published: true, country: { active: true } },
    select: { slug: true },
  });
  return pages.map((page) => page.slug);
}
