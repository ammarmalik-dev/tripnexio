"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { TrackStage } from "@/lib/mock-api/track";

interface StatusTimelineProps {
  stages: TrackStage[];
}

/** Animated horizontal (desktop) / vertical (mobile) status timeline — for the "Track Your Journey" dark-block motif (see CLAUDE.md Design direction). */
export function StatusTimeline({ stages }: StatusTimelineProps) {
  const shouldReduceMotion = useReducedMotion();
  const doneCount = stages.filter((stage) => stage.status !== "upcoming").length;
  const progress = stages.length > 1 ? (doneCount - 0.5) / (stages.length - 1) : 0;
  const progressPercent = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div
        className="absolute left-4 top-4 bottom-0 hidden w-px bg-hairline-on-dark sm:right-4 sm:left-0 sm:bottom-auto sm:h-px sm:w-auto sm:block"
        aria-hidden="true"
      />
      <motion.div
        className="absolute left-4 top-4 hidden w-px bg-accent sm:left-0 sm:h-px sm:w-auto sm:block"
        style={{ transformOrigin: "left" }}
        initial={shouldReduceMotion ? undefined : { scaleX: 0 }}
        animate={{ scaleX: progressPercent / 100 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden="true"
      />
      {stages.map((stage, index) => (
        <motion.div
          key={stage.label}
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: shouldReduceMotion ? 0 : index * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex flex-1 flex-row items-center gap-3 sm:flex-col sm:items-center sm:text-center"
        >
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              stage.status === "done" && "bg-success text-white",
              stage.status === "current" &&
                "bg-[image:var(--gradient-accent)] text-white shadow-[0_8px_20px_-6px_rgb(62_111_219_/_60%)]",
              stage.status === "upcoming" && "border border-hairline-on-dark text-ink-on-dark-muted"
            )}
          >
            {stage.status === "upcoming" ? (
              <Circle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
          <span className="flex flex-col sm:items-center">
            <span
              className={cn(
                "text-sm font-medium",
                stage.status === "upcoming" ? "text-ink-on-dark-tertiary" : "text-ink-on-dark-primary"
              )}
            >
              {stage.label}
            </span>
            {stage.date ? <span className="text-xs text-ink-on-dark-muted">{stage.date}</span> : null}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
