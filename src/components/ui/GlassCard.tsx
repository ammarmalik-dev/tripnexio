import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

const tierClass = {
  1: "glass-1",
  2: "glass-2",
  3: "glass-3",
  overlay: "glass-overlay",
} as const;

interface GlassCardProps<T extends ElementType> {
  as?: T;
  /** "overlay" is for floating surfaces shown over page content (dropdowns,
   * mega-menus, modals) that must stay fully legible — near-opaque, unlike
   * tiers 1-3 which are translucent inline cards. */
  tier?: 1 | 2 | 3 | "overlay";
  children: ReactNode;
  className?: string;
}

export function GlassCard<T extends ElementType = "div">({
  as,
  tier = 2,
  children,
  className,
  ...props
}: GlassCardProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof GlassCardProps<T>>) {
  const Component = as || "div";
  return (
    <Component
      className={cn(
        tierClass[tier],
        "rounded-xl p-6 text-ink-primary",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
