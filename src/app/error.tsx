"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";

/** P20 — branded error boundary for any route segment; never shows internals to the visitor. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[route-error]", error.digest ?? error.name);
  }, [error]);

  return (
    <Container className="flex flex-col items-center gap-5 py-24 text-center sm:py-32">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-ink-heading">Something went wrong</h1>
      <p className="max-w-md text-base text-ink-secondary">
        We couldn&apos;t load this page. Please try again — if it keeps happening, our support team can help.
      </p>
      {error.digest ? <p className="text-xs text-ink-tertiary">Reference: {error.digest}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/support" variant="glass">
          Get support
        </ButtonLink>
      </div>
    </Container>
  );
}
