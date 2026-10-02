"use client";

import { createContext, useContext, type ReactNode } from "react";
import { STATIC_SITE_CONTACT, type SiteContact } from "@/lib/site-contact";

const SiteContactContext = createContext<SiteContact>(STATIC_SITE_CONTACT);

/** Provided once by the root layout with the Admin-configured contact details (getSiteContact()). */
export function SiteContactProvider({ value, children }: { value: SiteContact; children: ReactNode }) {
  return <SiteContactContext.Provider value={value}>{children}</SiteContactContext.Provider>;
}

/** Phone, email, WhatsApp, address and socials for client components. Falls back to site-config.ts outside the provider. */
export function useSiteContact(): SiteContact {
  return useContext(SiteContactContext);
}
