"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { X, Phone, Mail } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SocialIcon, type SocialPlatform } from "@/components/ui/SocialIcon";
import { siteConfig } from "@/lib/site-config";
import { mainNav, headerActions, headerContact } from "@/lib/nav-config";

const socialLinks: { platform: SocialPlatform; href: string; label: string }[] = [
  { platform: "instagram", href: siteConfig.socials.instagram, label: "Instagram" },
  { platform: "facebook", href: siteConfig.socials.facebook, label: "Facebook" },
  { platform: "linkedin", href: siteConfig.socials.linkedin, label: "LinkedIn" },
  { platform: "x", href: siteConfig.socials.x, label: "X" },
  { platform: "threads", href: siteConfig.socials.threads, label: "Threads" },
  { platform: "whatsapp", href: siteConfig.contact.whatsappHref, label: "WhatsApp" },
];

interface SiteDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Slide-in site menu — triggered from the hamburger on smaller screens. */
export function SiteDrawer({ open, onClose }: SiteDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60"
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
            aria-label="Site menu"
            onKeyDown={onPanelKeyDown}
            initial={shouldReduceMotion ? undefined : { x: "100%" }}
            animate={{ x: 0 }}
            exit={shouldReduceMotion ? undefined : { x: "100%" }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="glass-overlay fixed inset-y-0 right-0 z-[70] isolate flex w-full max-w-sm flex-col overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <span className="text-sm font-semibold text-ink-primary">Menu</span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-primary hover:bg-white/[0.05]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Primary">
              {mainNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="rounded-md px-3 py-3 text-sm font-medium text-ink-primary hover:bg-white/[0.05]"
                >
                  {item.label}
                </Link>
              ))}

              <div className="my-2 border-t border-hairline" />

              <Link
                href={headerActions.login.href}
                onClick={onClose}
                className="rounded-md px-3 py-3 text-sm font-medium text-ink-primary hover:bg-white/[0.05]"
              >
                {headerActions.login.label}
              </Link>
            </nav>

            <div className="mt-auto flex flex-col gap-4 border-t border-hairline px-5 py-5">
              <div className="flex flex-col gap-2 text-sm text-ink-secondary">
                <a href={headerContact.phoneHref} className="flex items-center gap-2 hover:text-ink-primary">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {headerContact.phoneDisplay}
                </a>
                <a href={headerContact.emailHref} className="flex items-center gap-2 hover:text-ink-primary">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {headerContact.emailDisplay}
                </a>
              </div>

              <div className="flex items-center gap-3">
                {socialLinks.map(({ platform, href, label }) => (
                  <a
                    key={platform}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink-secondary hover:border-glass-border hover:text-ink-primary"
                  >
                    <SocialIcon platform={platform} className="h-4 w-4" />
                  </a>
                ))}
              </div>

              <ButtonLink
                href={headerActions.getStarted.href}
                variant="primary"
                size="lg"
                onClick={onClose}
                className="w-full"
              >
                {headerActions.getStarted.label}
              </ButtonLink>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
