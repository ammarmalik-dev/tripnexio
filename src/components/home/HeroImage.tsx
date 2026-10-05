import Image from "next/image";

/**
 * Homepage hero photo — one fixed image (client correction 2026-10-05:
 * "Fix one hero image on homepage, remove slidebar"). The client's own photo,
 * kept bright with a light legibility wash behind the dark-navy headline.
 */
export function HeroImage() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-surface-base" aria-hidden="true">
      <Image
        src="/images/hero/home.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_42%,rgb(247_245_240_/_62%)_0%,transparent_72%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-surface-base" />
    </div>
  );
}
