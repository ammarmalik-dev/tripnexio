"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/**
 * Client corrections 2026-10-05 — desktop header "Customer Login"; once the
 * customer is signed in it reads "My Account" and opens the portal.
 */
export function CustomerAccountLink({ className }: { className?: string }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const me = await getJson<{ id: string } | null>("/api/auth/me");
        if (!cancelled) setSignedIn(Boolean(me));
      } catch {
        // Stays "Customer Login".
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-ink-secondary transition-colors duration-200 hover:text-ink-primary", className)}
    >
      <UserRound className="h-4 w-4" aria-hidden="true" />
      {signedIn ? "My Account" : "Customer Login"}
    </Link>
  );
}
