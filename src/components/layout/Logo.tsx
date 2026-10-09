import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  /** "onLight" (default) for the navy symbol on white/warm-white surfaces,
   * "onDark" for the reverse (white) symbol on the dark-navy blocks
   * (footer). See public/brand — tripnexio-symbol.svg vs -dark.svg. */
  variant?: "onLight" | "onDark";
  /** "lg" for a standalone brand moment such as the CRM login card (client testing 2026-10-09, F11). */
  size?: "md" | "lg";
}

export function Logo({ className, variant = "onLight", size = "md" }: LogoProps) {
  const symbol = size === "lg" ? 44 : 28;
  return (
    <Link href="/" className={className} aria-label="TripNexio home">
      <span className={cn("flex items-center", size === "lg" ? "gap-3" : "gap-2.5")}>
        <Image
          src={variant === "onDark" ? "/brand/tripnexio-symbol-dark.svg" : "/brand/tripnexio-symbol.svg"}
          alt=""
          width={symbol}
          height={symbol}
          priority
        />
        <span
          className={cn(
            size === "lg" ? "text-3xl font-bold tracking-tight" : "text-lg font-semibold tracking-tight",
            variant === "onDark" ? "text-ink-on-dark-primary" : "text-ink-heading"
          )}
        >
          TripNexio
        </span>
      </span>
    </Link>
  );
}
