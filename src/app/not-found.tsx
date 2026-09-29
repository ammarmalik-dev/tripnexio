import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/** P20 — branded 404. */
export default function NotFound() {
  return (
    <Container className="flex flex-col items-center gap-5 py-24 text-center sm:py-32">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
        <Compass className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium tracking-wide text-ink-accent uppercase">404</p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink-heading sm:text-4xl">This page took a different route</h1>
      <p className="max-w-md text-base text-ink-secondary">
        The page you&apos;re looking for doesn&apos;t exist or has moved. Explore our services or track an existing request.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/services">Browse Services</ButtonLink>
        <ButtonLink href="/track" variant="glass">
          Track Status
        </ButtonLink>
      </div>
    </Container>
  );
}
