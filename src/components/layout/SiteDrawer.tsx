"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronDown, X, Phone, Mail } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SocialIcon, type SocialPlatform } from "@/components/ui/SocialIcon";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/lib/site-config";
import { mainNav, utilityLinks, headerActions, headerContact } from "@/lib/nav-config";

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

/** Slide-in site menu — triggered from the sidebar icon on desktop and the hamburger on mobile. */
export function SiteDrawer({ open, onClose }: SiteDrawerProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
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
    <AnimatePresence onExitComplete={() => setOpenGroup(null)}>
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
              {mainNav.map((item) => {
                if (item.type === "link") {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="rounded-md px-3 py-3 text-sm font-medium text-ink-primary hover:bg-white/[0.05]"
                    >
                      {item.label}
                    </Link>
                  );
                }

                const isOpen = openGroup === item.label;
                return (
                  <div key={item.label} className="rounded-md">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenGroup(isOpen ? null : item.label)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-3 text-sm font-medium text-ink-primary hover:bg-white/[0.05]"
                    >
                      {item.label}
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                          transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-1 py-1 pl-3">
                            {item.items.map((sub) => {
                              const Icon = sub.icon;
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={onClose}
                                  className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-white/[0.05]"
                                >
                                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent-light">
                                    <Icon className="h-4 w-4" aria-hidden="true" />
                                  </span>
                                  <span className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium text-ink-primary">{sub.label}</span>
                                    <span className="text-xs text-ink-tertiary">{sub.description}</span>
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}

              <div className="my-2 border-t border-hairline" />

              <Link
                href={utilityLinks.trackStatus.href}
                onClick={onClose}
                className="rounded-md px-3 py-3 text-sm font-medium text-ink-primary hover:bg-white/[0.05]"
              >
                {utilityLinks.trackStatus.label}
              </Link>
              <Link
                href={utilityLinks.askAi.href}
                onClick={onClose}
                className="rounded-md px-3 py-3 text-sm font-medium text-ink-primary hover:bg-white/[0.05]"
              >
                {utilityLinks.askAi.label}
              </Link>
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
