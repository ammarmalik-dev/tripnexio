"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, Menu, PanelRightOpen } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Logo } from "./Logo";
import { TopUtilityBar } from "./TopUtilityBar";
import { NavDropdown } from "./NavDropdown";
import { SiteDrawer } from "./SiteDrawer";
import { Container } from "@/components/ui/Container";
import { QuickStartForm } from "@/components/quick-start/QuickStartForm";
import { QuickStartMobileDock } from "@/components/quick-start/QuickStartMobileDock";
import { QuickStartSheet } from "@/components/quick-start/QuickStartSheet";
import { useQuickStart } from "@/components/quick-start/QuickStartProvider";
import { cn } from "@/lib/cn";
import { mainNav, headerActions } from "@/lib/nav-config";
import { NAV_DOCK_OFFSET_PX } from "@/lib/quick-start-config";

const SCROLL_THRESHOLD = 32;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { docked, overlayOpen, setOverlayOpen } = useQuickStart();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const swapTransition = { duration: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <header className="contents">
      <TopUtilityBar />

      <div
        className={cn(
          "sticky top-0 z-50 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-300 ease-out",
          scrolled || docked ? "glass-2" : "border-b border-transparent bg-transparent"
        )}
      >
        <Container className="flex h-18 items-center justify-between">
          <Logo />

          <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
            <AnimatePresence initial={false} mode="wait">
              {docked ? (
                <motion.div
                  key="dock"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                  transition={swapTransition}
                  className="no-scrollbar will-change-transform max-w-full overflow-x-auto"
                >
                  <QuickStartForm layout="compact" />
                </motion.div>
              ) : (
                <motion.nav
                  key="links"
                  aria-label="Primary"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                  transition={swapTransition}
                  className="will-change-transform flex items-center gap-7"
                >
                  {mainNav.map((item) =>
                    item.type === "dropdown" ? (
                      <NavDropdown
                        key={item.label}
                        label={item.label}
                        items={item.items}
                        isActive={item.items.some((sub) => isActive(sub.href))}
                      />
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "text-sm font-medium transition-colors duration-200",
                          isActive(item.href)
                            ? "text-ink-primary"
                            : "text-ink-secondary hover:text-ink-primary"
                        )}
                      >
                        {item.label}
                      </Link>
                    )
                  )}
                </motion.nav>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href={headerActions.login.href}
              aria-label={headerActions.login.label}
              title={headerActions.login.label}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors duration-200 hover:bg-white/[0.05] hover:text-ink-primary"
            >
              <CircleUser className="h-5 w-5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors duration-200 hover:bg-white/[0.05] hover:text-ink-primary"
            >
              <PanelRightOpen className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-md text-ink-primary lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </Container>
      </div>

      {/* Mobile docked pill — fixed (not in flow) so it never reflows page content. */}
      <div className="lg:hidden">
        <AnimatePresence>
          {docked ? (
            <motion.div
              key="mobile-dock"
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -12 }}
              transition={swapTransition}
              className="will-change-transform fixed inset-x-0 z-40 px-4 pb-3 pt-2"
              style={{ top: NAV_DOCK_OFFSET_PX }}
            >
              <QuickStartMobileDock />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <SiteDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <QuickStartSheet open={overlayOpen} onClose={() => setOverlayOpen(false)} />
    </header>
  );
}
