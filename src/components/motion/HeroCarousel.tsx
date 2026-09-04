"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { heroSlides } from "@/lib/hero-images";
import { cn } from "@/lib/cn";

const AUTO_ADVANCE_MS = 6000;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const shouldReduceMotion = useReducedMotion();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((next: number) => {
    setIndex(((next % heroSlides.length) + heroSlides.length) % heroSlides.length);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    timeoutRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % heroSlides.length);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [index, isPlaying]);

  const slide = heroSlides[index];

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-surface-base"
      role="region"
      aria-roledescription="carousel"
      aria-label="TripNexio destinations across the UAE and GCC"
      onMouseEnter={() => setIsPlaying(false)}
      onMouseLeave={() => setIsPlaying(true)}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.src}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${heroSlides.length}: ${slide.location}`}
          initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={{
            opacity: { duration: shouldReduceMotion ? 0 : 1, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: shouldReduceMotion ? 0 : AUTO_ADVANCE_MS / 1000 + 1, ease: "linear" },
          }}
          className="absolute inset-0 will-change-transform"
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={index === 0}
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Legibility scrim — keeps hero text readable regardless of the photo underneath. */}
      <div className="absolute inset-0 bg-surface-base/60" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-gradient-to-b from-surface-base/30 via-surface-base/55 to-surface-base"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,transparent_0%,var(--surface-base)_78%)]"
        aria-hidden="true"
      />

      <div className="sr-only" aria-live="polite">
        Showing slide {index + 1} of {heroSlides.length}: {slide.location}
      </div>

      {/* Prev / next — desktop only, mobile relies on autoplay + dots. */}
      <button
        type="button"
        onClick={() => goTo(index - 1)}
        aria-label="Previous slide"
        className="glass-1 absolute left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-primary transition-colors duration-200 hover:border-glass-border-strong sm:flex"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        aria-label="Next slide"
        className="glass-1 absolute right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-primary transition-colors duration-200 hover:border-glass-border-strong sm:flex"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Location + dots + play/pause */}
      <div className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-3 sm:bottom-8">
        <span className="text-xs font-medium tracking-wide text-ink-secondary">
          {slide.location}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {heroSlides.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}: ${s.location}`}
                aria-current={i === index}
                className="p-1"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-pill transition-all duration-300",
                    i === index ? "w-6 bg-accent-light" : "w-1.5 bg-white/30"
                  )}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
            aria-pressed={!isPlaying}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-tertiary transition-colors duration-200 hover:text-ink-primary"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
