import type { Metadata } from "next";
import { ServicesGrid } from "@/components/home/ServicesGrid";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Visa and flight services for travellers from India to the UAE and Middle East — new visa, extension, visa change, special fare, return verified ticket and OTB.",
};

// The service list is Admin-managed; never serve a build-time snapshot.
export const dynamic = "force-dynamic";

export default function ServicesPage() {
  return <ServicesGrid />;
}
