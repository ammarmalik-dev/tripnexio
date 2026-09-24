import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HideOnCrm } from "@/components/layout/HideOnCrm";
import { MaintenanceBanner } from "@/components/layout/MaintenanceBanner";
import { Toaster } from "@/components/ui/Toaster";
import { siteConfig } from "@/lib/site-config";
import { getEffectiveSiteConfig, getSystemConfig } from "@/lib/settings/system-config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Step 45 — async so page metadata can reflect SystemConfig's company-info
 * overrides (name/tagline/description) instead of always the static
 * site-config.ts defaults. `url`/`ogImage` deliberately stay on the static
 * siteConfig — see getEffectiveSiteConfig()'s own doc comment for why.
 */
export async function generateMetadata(): Promise<Metadata> {
  const effective = await getEffectiveSiteConfig();
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: `${effective.name} — ${effective.tagline}`,
      template: `%s | ${effective.name}`,
    },
    description: effective.description,
    openGraph: {
      type: "website",
      locale: "en_US",
      url: siteConfig.url,
      siteName: effective.name,
      title: effective.name,
      description: effective.description,
      images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: effective.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: effective.name,
      description: effective.description,
      images: [siteConfig.ogImage],
      site: "@tripnexio",
    },
    icons: {
      icon: "/icon.svg",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { maintenanceModeEnabled, maintenanceMessage } = await getSystemConfig();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface-base text-ink-primary">
        {maintenanceModeEnabled ? (
          <HideOnCrm>
            <MaintenanceBanner message={maintenanceMessage || "We're performing scheduled maintenance — some features may be temporarily slow."} />
          </HideOnCrm>
        ) : null}
        <HideOnCrm>
          <Navbar />
        </HideOnCrm>
        <main className="flex-1">{children}</main>
        <HideOnCrm>
          <Footer />
        </HideOnCrm>
        <Toaster />
      </body>
    </html>
  );
}
