"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { QuickStartForm } from "./QuickStartForm";
import { useQuickStart } from "./QuickStartProvider";
import { NAV_DOCK_OFFSET_PX } from "@/lib/quick-start-config";

/** Small buffer + debounce so the dock state doesn't flicker right at the boundary. */
const DOCK_MARGIN_BUFFER_PX = 16;
const HYSTERESIS_DELAY_MS = 80;

export function QuickStartBar() {
  const { docked, setDocked, setOverlayOpen } = useQuickStart();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
        // isIntersecting=false must mean ONE thing only: "scrolled up past the
        // navbar line". A plain top-only rootMargin is ambiguous (it's also
        // false before the sentinel has ever been scrolled to, e.g. on first
        // paint with a tall hero) — worse, on a large/fast scroll the browser
        // can sample before *and* after the sentinel passes through the
        // intersecting zone without ever reporting it, leaving the state
        // stuck. A huge bottom margin removes the second edge entirely, so
        // there's nothing to skip over — the top line is the only boundary.
        const next = !entry.isIntersecting;
        pendingTimeout.current = setTimeout(() => setDocked(next), HYSTERESIS_DELAY_MS);
      },
      {
        root: null,
        rootMargin: `-${NAV_DOCK_OFFSET_PX + DOCK_MARGIN_BUFFER_PX}px 0px 100000px 0px`,
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
    };
  }, [setDocked]);

  const exitY = shouldReduceMotion ? 0 : -16;
  const enterY = shouldReduceMotion ? 0 : 16;
  const duration = shouldReduceMotion ? 0 : 0.32;
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <div className="w-full">
      {/* Desktop / tablet: full inline bar. Spacer reserves height so docking
          never shifts the page — only opacity/transform animate. */}
      <div className="relative hidden w-full md:block">
        <div className="invisible pointer-events-none" aria-hidden="true">
          <GlassCard tier={3} className="w-full p-4 lg:p-5">
            <QuickStartForm layout="horizontal" />
          </GlassCard>
        </div>
        <AnimatePresence>
          {!docked ? (
            <motion.div
              initial={{ opacity: 0, y: enterY }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: exitY }}
              transition={{ duration, ease }}
              className="will-change-transform absolute inset-0"
            >
              <GlassCard tier={3} className="w-full p-4 lg:p-5">
                <QuickStartForm layout="horizontal" />
              </GlassCard>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Mobile: full-width tap target opening the bottom sheet. */}
      <div className="relative w-full md:hidden">
        <div className="invisible pointer-events-none" aria-hidden="true">
          <div className="glass-3 flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4">
            <span>
              <span className="block text-sm font-semibold">Start your application</span>
              <span className="mt-0.5 block text-xs">UAE Visa, Flights or OTB</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
          </div>
        </div>
        <AnimatePresence>
          {!docked ? (
            <motion.button
              type="button"
              onClick={() => setOverlayOpen(true)}
              initial={{ opacity: 0, y: enterY }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: exitY }}
              transition={{ duration, ease }}
              className="will-change-transform glass-3 absolute inset-0 flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-ink-primary">
                  Start your application
                </span>
                <span className="mt-0.5 block text-xs text-ink-secondary">
                  UAE Visa, Flights or OTB
                </span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-accent-light" aria-hidden="true" />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      <div ref={sentinelRef} aria-hidden="true" className="h-0 w-full" />
    </div>
  );
}
