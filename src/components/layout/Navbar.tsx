"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "./Logo";
import { SiteDrawer } from "./SiteDrawer";
import { Container } from "@/components/ui/Container";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { cn } from "@/lib/cn";
import { mainNav } from "@/lib/nav-config";
import { siteConfig } from "@/lib/site-config";

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

  const isActive = (href: string) =>
    href.startsWith("/#") ? false : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="contents">
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
            className="hidden min-w-0 flex-1 items-center justify-center gap-8 lg:flex"
          >
            {mainNav.map((item) => (
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
            ))}
          </nav>

          <div className="hidden lg:flex">
            <a
              href={siteConfig.contact.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-2 flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-glass-border-strong"
            >
              <SocialIcon platform="whatsapp" className="h-4 w-4 text-success" />
              WhatsApp Support
            </a>
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
