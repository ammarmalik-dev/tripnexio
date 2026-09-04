"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

interface GradientMeshProps {
  className?: string;
}

/**
 * Subtle animated gradient-mesh backdrop for hero sections.
 * Absolutely positioned — the parent must be `relative` (or set its own stacking context).
 */
export function GradientMesh({ className }: GradientMeshProps) {
  const shouldReduceMotion = useReducedMotion();

  const blobs = [
    {
      className:
        "left-[-10%] top-[-15%] h-[38rem] w-[38rem] bg-[radial-gradient(circle_at_center,var(--accent)_0%,transparent_70%)] opacity-25",
      animate: shouldReduceMotion
        ? undefined
        : { x: [0, 30, -10, 0], y: [0, -20, 15, 0] },
      duration: 26,
    },
    {
      className:
        "right-[-15%] top-[10%] h-[34rem] w-[34rem] bg-[radial-gradient(circle_at_center,var(--accent-dark)_0%,transparent_70%)] opacity-40",
      animate: shouldReduceMotion
        ? undefined
        : { x: [0, -25, 15, 0], y: [0, 20, -15, 0] },
      duration: 32,
    },
    {
      className:
        "left-[20%] bottom-[-20%] h-[30rem] w-[30rem] bg-[radial-gradient(circle_at_center,var(--accent-light)_0%,transparent_70%)] opacity-15",
      animate: shouldReduceMotion
        ? undefined
        : { x: [0, 15, -25, 0], y: [0, -15, 10, 0] },
      duration: 30,
    },
  ];

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          className={cn("absolute rounded-full blur-3xl", blob.className)}
          animate={blob.animate}
          transition={
            blob.animate
              ? { duration: blob.duration, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,transparent_0%,var(--surface-base)_75%)]" />
    </div>
  );
}
