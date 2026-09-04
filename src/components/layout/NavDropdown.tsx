"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/cn";
import type { NavSubItem } from "@/lib/nav-config";

interface NavDropdownProps {
  label: string;
  items: NavSubItem[];
  isActive?: boolean;
}

const CLOSE_DELAY = 150;

export function NavDropdown({ label, items, isActive }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const shouldReduceMotion = useReducedMotion();

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
  }, []);

  const openNow = useCallback(() => {
    clearCloseTimeout();
    setOpen(true);
  }, [clearCloseTimeout]);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    closeTimeout.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, [clearCloseTimeout]);

  const closeAndRefocus = useCallback(() => {
    clearCloseTimeout();
    setOpen(false);
    triggerRef.current?.focus();
  }, [clearCloseTimeout]);

  useEffect(() => clearCloseTimeout, [clearCloseTimeout]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const focusItem = (index: number) => {
    const clamped = (index + items.length) % items.length;
    itemRefs.current[clamped]?.focus();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openNow();
      requestAnimationFrame(() => focusItem(0));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRefocus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(currentIndex - 1);
    }
  };

  const onWrapperBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!wrapperRef.current?.contains(event.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative isolate"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onBlur={onWrapperBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? setOpen(false) : openNow())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex items-center gap-1 text-sm font-medium transition-colors duration-200",
          isActive ? "text-ink-primary" : "text-ink-secondary hover:text-ink-primary"
        )}
      >
        {label}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            role="group"
            aria-label={label}
            onKeyDown={onPanelKeyDown}
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-full z-[60] mt-3 w-80 -translate-x-1/2"
          >
            <GlassCard tier="overlay" className="flex flex-col gap-1 p-2">
              {items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    className="flex items-start gap-3 rounded-md p-3 transition-colors duration-200 hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light focus-visible:-outline-offset-2"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent-light">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-ink-primary">{item.label}</span>
                      <span className="text-xs text-ink-tertiary">{item.description}</span>
                    </span>
                  </Link>
                );
              })}
            </GlassCard>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
