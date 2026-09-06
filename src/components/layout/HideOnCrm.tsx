"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The CRM (/crm/**) and Admin (/admin/**) sections have their own denser,
 * functional chrome — they should never show the marketing site's
 * Navbar/Footer. Wrapping them here (rather than restructuring the whole
 * app into route groups with separate root layouts) keeps this a small,
 * low-risk addition; the wrapped components can stay exactly as they are,
 * including Server Components passed in as children.
 */
export function HideOnCrm({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/crm") || pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
