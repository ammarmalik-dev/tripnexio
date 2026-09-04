"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QuickStartForm } from "./QuickStartForm";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface QuickStartSheetProps {
  open: boolean;
  onClose: () => void;
}

export function QuickStartSheet({ open, onClose }: QuickStartSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const onKeyDown = useFocusTrap(panelRef, open);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[80] bg-black/60 lg:hidden"
            initial={shouldReduceMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Start your application"
            onKeyDown={onKeyDown}
            initial={shouldReduceMotion ? undefined : { y: "100%" }}
            animate={{ y: 0 }}
            exit={shouldReduceMotion ? undefined : { y: "100%" }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="glass-overlay will-change-transform fixed inset-x-0 bottom-0 z-[90] isolate max-h-[85vh] overflow-y-auto rounded-t-xl lg:hidden"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-inherit px-5 py-4">
              <span className="text-sm font-semibold text-ink-primary">
                Start your application
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-primary hover:bg-white/[0.05]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-5 py-5">
              <QuickStartForm layout="stacked" onNavigate={onClose} />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
