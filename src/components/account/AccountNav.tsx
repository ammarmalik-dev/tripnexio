"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, Briefcase, Search, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/account", label: "My Bookings", icon: Briefcase },
  { href: "/account/action-required", label: "Action Required", icon: AlertCircle },
  { href: "/account/profile", label: "My Profile", icon: UserRound },
  { href: "/track", label: "Track Status", icon: Search },
];

/** Client corrections 2026-10-05 — the customer portal tabs: My Bookings › Action Required › My Profile, Track Status and Log Out. */
export function AccountNav({ actionCount }: { actionCount: number }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/account" ? pathname === "/account" || pathname.startsWith("/account/bookings") : pathname.startsWith(href));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
      <nav aria-label="My account" className="flex flex-wrap gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              isActive(href) ? "bg-[image:var(--gradient-accent)] text-white" : "text-ink-secondary hover:bg-ink-primary/[0.04] hover:text-ink-primary"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {href === "/account/action-required" && actionCount > 0 ? (
              <span className={cn("rounded-full px-1.5 text-xs font-bold", isActive(href) ? "bg-white/25" : "bg-error text-white")}>{actionCount}</span>
            ) : null}
          </Link>
        ))}
      </nav>
      <LogoutButton />
    </div>
  );
}
