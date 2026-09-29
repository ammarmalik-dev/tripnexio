import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

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

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({ url: `${siteConfig.url}${path}`, lastModified: new Date() }));
}
