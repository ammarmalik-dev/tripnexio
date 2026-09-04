"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { Destination } from "@/lib/destinations-config";

interface DestinationCardProps {
  destination: Destination;
}

export function DestinationCard({ destination }: DestinationCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Link
      href={`/services/new-visa?country=${destination.code}`}
      className="group block h-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light focus-visible:outline-offset-2"
    >
      <motion.div
        whileHover={shouldReduceMotion ? undefined : { y: -6 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full will-change-transform flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-[0_8px_24px_-12px_rgb(0_0_0_/_50%)] transition-shadow duration-300 group-hover:shadow-[0_20px_40px_-16px_rgb(0_0_0_/_65%)] group-hover:border-glass-border-strong"
      >
        <div className="relative flex aspect-[4/5] items-end justify-center overflow-hidden">
          <Image
            src={destination.image}
            alt={destination.imageAlt}
            fill
            sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
            className={
              shouldReduceMotion
                ? "object-cover"
                : "object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            }
          />
          <div
            className="absolute inset-0"
            style={{ background: destination.gradient }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 opacity-70"
            style={{ background: "linear-gradient(180deg, transparent 40%, rgb(10 14 26 / 85%) 100%)" }}
            aria-hidden="true"
          />
          <span
            className="relative mb-[-24px] flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-4 border-surface-1 bg-surface-2 shadow-md"
            aria-hidden="true"
          >
            <span className={`fi fis fi-${destination.code.toLowerCase()} !h-8 !w-8 rounded-full`} />
          </span>
        </div>
        <div className="flex min-h-[4.5rem] flex-col items-center justify-start px-4 pb-4 pt-8 text-center">
          <p className="text-base font-semibold tracking-tight text-ink-primary">{destination.name}</p>
        </div>
        <div className="grid flex-1 grid-cols-1 content-start gap-1 border-t border-hairline px-4 py-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">Services</span>
          <span className="min-h-[2.25rem] text-xs text-ink-secondary">{destination.services}</span>
        </div>
      </motion.div>
    </Link>
  );
}
