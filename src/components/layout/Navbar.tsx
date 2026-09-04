"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, Menu, PanelRightOpen } from "lucide-react";
import { Logo } from "./Logo";
import { TopUtilityBar } from "./TopUtilityBar";
import { NavDropdown } from "./NavDropdown";
import { SiteDrawer } from "./SiteDrawer";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";
import { mainNav, headerActions } from "@/lib/nav-config";

const SCROLL_THRESHOLD = 32;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="contents">
      <TopUtilityBar />

      <div
        className={cn(
          "sticky top-0 z-50 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-300 ease-out",
          scrolled ? "glass-2" : "border-b border-transparent bg-transparent"
        )}
      >
        <Container className="flex h-18 items-center justify-between">
          <Logo />

          <nav
            aria-label="Primary"
            className="hidden min-w-0 flex-1 items-center justify-center gap-7 lg:flex"
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
          </nav>

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

      <SiteDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  );
}
