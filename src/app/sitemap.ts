import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { getPublishedCountrySlugs } from "@/lib/new-visa/country-pages";

// Picks up newly published New Visa country pages without a redeploy.
export const revalidate = 3600;

const PUBLIC_PATHS = [
  "",
  "/services",
  "/services/new-visa",
  "/services/visa-extension",
  "/services/visa-change",
  "/services/flight-special-fare",
  "/services/return-ticket",
  "/services/otb",
  "/track",
  "/ai",
  "/about",
  "/faq",
  "/blog",
  "/payment-support",
  "/contact",
  "/support",
  "/whatsapp-support",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refund-policy",
  "/legal/cookie-policy",
  "/legal/disclaimer",
  "/legal/grievance-redressal",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let countrySlugs: string[] = [];
  try {
    countrySlugs = await getPublishedCountrySlugs();
  } catch (error) {
    // The static pages still go out if the database is unreachable.
    console.error("[sitemap] couldn't load New Visa country pages", error);
  }
  const paths = [...PUBLIC_PATHS, ...countrySlugs.map((slug) => `/services/new-visa/${slug}`)];
  return paths.map((path) => ({ url: `${siteConfig.url}${path}`, lastModified: new Date() }));
}
