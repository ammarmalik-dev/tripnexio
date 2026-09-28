"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LogIn, UserRound } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GoogleButton, customerGoogleHref } from "@/components/auth/GoogleButton";

/** The Log In / Continue as Guest choice shown before a request form to a signed-out visitor. */
export function ApplyChoice({ children, googleEnabled }: { children: ReactNode; googleEnabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [asGuest, setAsGuest] = useState(false);

  if (asGuest) return <>{children}</>;

  const query = searchParams.toString();
  const next = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <Container className="py-16 sm:py-24">
      <GlassCard tier={2} className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-heading">How would you like to continue?</h1>
          <p className="text-sm text-ink-secondary">
            Log in to keep all your applications, documents and status updates in one account, or continue as a
            guest — we&apos;ll use your mobile number and email for this request.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ButtonLink href={`/login?next=${encodeURIComponent(next)}`} size="lg" className="gap-2">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Log In
          </ButtonLink>
          <Button type="button" size="lg" variant="glass" className="gap-2" onClick={() => setAsGuest(true)}>
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Continue as Guest
          </Button>
        </div>
        {googleEnabled ? <GoogleButton href={customerGoogleHref(next)} /> : null}
      </GlassCard>
    </Container>
  );
}
