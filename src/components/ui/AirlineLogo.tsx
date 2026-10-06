"use client";

import { cn } from "@/lib/cn";

/**
 * Client corrections 2026-10-05 §9 — the airline's logo (from the Airline
 * master) wherever flight details are shown. Hides itself if the image
 * can't load, so a missing logo never shows a broken-image icon.
 */
export function AirlineLogo({ src, name, className }: { src: string | null | undefined; name: string; className?: string }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external logo host; next/image would need every possible host allow-listed.
    <img
      src={src}
      alt={`${name} logo`}
      loading="lazy"
      className={cn("h-7 w-7 shrink-0 rounded-md bg-white object-contain", className)}
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}
