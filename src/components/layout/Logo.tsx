import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  /** "onLight" (default) for the navy symbol on white/warm-white surfaces,
   * "onDark" for the reverse (white) symbol on the dark-navy blocks
   * (footer). See public/brand — tripnexio-symbol.svg vs -dark.svg. */
  variant?: "onLight" | "onDark";
}

export function Logo({ className, variant = "onLight" }: LogoProps) {
  return (
    <Link href="/" className={className} aria-label="TripNexio home">
      <span className="flex items-center gap-2.5">
        <Image
          src={variant === "onDark" ? "/brand/tripnexio-symbol-dark.svg" : "/brand/tripnexio-symbol.svg"}
          alt=""
          width={28}
          height={28}
          priority
        />
        <span
          className={cn(
            "text-lg font-semibold tracking-tight",
            variant === "onDark" ? "text-ink-on-dark-primary" : "text-ink-heading"
          )}
        >
          TripNexio
        </span>
      </span>
    </Link>
  );
}
