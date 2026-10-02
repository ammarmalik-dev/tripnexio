import Image from "next/image";
import { SERVICE_ROUTE_INFO } from "@/lib/service-route-info";

interface ServiceHeroBackdropProps {
  /** ServiceType code — picks the default photo from SERVICE_ROUTE_INFO. */
  service: keyof typeof SERVICE_ROUTE_INFO;
  /** An Admin-uploaded photo (e.g. a New Visa country page's hero) used instead of the default. */
  imageSrc?: string | null;
}

/**
 * Full-bleed photo behind a service landing page's hero. The parent section
 * must be `relative overflow-hidden`. A warm-white wash keeps the dark
 * headline readable (light-first design) while the photo stays visible at
 * the edges, then fades into the page background at the bottom.
 */
export function ServiceHeroBackdrop({ service, imageSrc }: ServiceHeroBackdropProps) {
  const info = SERVICE_ROUTE_INFO[service];
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-surface-base">
      {imageSrc ? (
        // Served by our own image route (already sized by the uploader), so no optimiser pass.
        <Image src={imageSrc} alt="" fill priority unoptimized sizes="100vw" className="object-cover" />
      ) : (
        <Image src={info.image} alt="" fill priority quality={90} sizes="100vw" className="object-cover" />
      )}
      <div className="service-hero-wash absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-surface-base" />
    </div>
  );
}
