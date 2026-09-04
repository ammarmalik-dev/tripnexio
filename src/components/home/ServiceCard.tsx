"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";

interface ServiceCardProps {
  title: string;
  description: string;
  href: string;
  image: string;
  imageAlt: string;
  icon: ReactNode;
}

export function ServiceCard({ title, description, href, image, imageAlt, icon }: ServiceCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="group flex h-full will-change-transform flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-[0_8px_24px_-12px_rgb(0_0_0_/_50%)] transition-shadow duration-300 hover:shadow-[0_20px_40px_-16px_rgb(0_0_0_/_65%)] hover:border-glass-border-strong"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
          className={
            shouldReduceMotion
              ? "object-cover"
              : "object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          }
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-surface-1 via-transparent to-transparent"
          aria-hidden="true"
        />
        <span className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-[0_4px_12px_-2px_rgb(17_19_24_/_35%)]">
          {icon}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-5 pb-5 pt-4">
        <h3 className="text-base font-semibold tracking-tight text-ink-heading">{title}</h3>
        <p className="flex-1 text-sm text-ink-secondary">{description}</p>
        <ButtonLink href={href} variant="ghost" size="sm" className="mt-2 w-fit gap-1.5">
          Start {title.split(" — ")[0]}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </ButtonLink>
      </div>
    </motion.div>
  );
}
