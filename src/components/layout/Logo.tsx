import Link from "next/link";
import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  /** "onLight" (default) for navy "Trip" on white/warm-white surfaces, "onDark" for white "Trip" on the dark-navy blocks (footer, sidebar). */
  variant?: "onLight" | "onDark";
  /** "lg" for a standalone brand moment such as the CRM login card (client testing 2026-10-09, F11). */
  size?: "md" | "lg";
}

/** Client 2026-10-29 — the wordmark only ("Trip" + Electric Blue "Nexio"), no "N" symbol, everywhere. */
export function Logo({ className, variant = "onLight", size = "md" }: LogoProps) {
  return (
    <Link href="/" className={className} aria-label="TripNexio home">
      <span
        className={cn(
          size === "lg" ? "text-3xl font-bold tracking-tight" : "text-xl font-bold tracking-tight",
          variant === "onDark" ? "text-ink-on-dark-primary" : "text-ink-heading"
        )}
      >
        Trip<span className="text-accent">Nexio</span>
      </span>
    </Link>
  );
}
