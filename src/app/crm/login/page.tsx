import type { Metadata } from "next";
import Image from "next/image";
import { BarChart3, Plane, ShieldCheck, UsersRound } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/layout/Logo";
import { StaffLoginForm } from "@/components/crm/StaffLoginForm";
import { isGoogleSignInConfigured } from "@/lib/auth/google";

export const metadata: Metadata = {
  title: "TripNexio Internal Dashboard",
  description: "Sign in to the TripNexio Internal Dashboard.",
};

interface StaffLoginPageProps {
  searchParams: Promise<{ from?: string; google?: string }>;
}

// Client's login reference (corrections document 2026-10-05).
const highlights = [
  { title: "Visa & Travel Services", detail: "Faster processing", Icon: Plane },
  { title: "Better Collaboration", detail: "Work together seamlessly", Icon: UsersRound },
  { title: "Operational Efficiency", detail: "Track, manage and grow", Icon: BarChart3 },
  { title: "Secure & Reliable", detail: "Your data, always safe", Icon: ShieldCheck },
];

export default async function StaffLoginPage({ searchParams }: StaffLoginPageProps) {
  const { from, google } = await searchParams;

  return (
    <section className="crm-login-wash relative flex min-h-dvh items-center overflow-hidden py-10 sm:py-16">
      {/* Client login reference: globe + network visual on the right (wide screens only). */}
      <Image
        src="/brand/login-globe.webp"
        alt=""
        aria-hidden="true"
        width={477}
        height={1024}
        priority
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto object-cover [mask-image:linear-gradient(to_right,transparent,black_22%)] xl:block"
      />
      <Container className="relative grid w-full items-center gap-10 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)_14rem]">
        <div className="hidden flex-col gap-6 lg:flex">
          <h1 className="max-w-md text-5xl font-bold tracking-tight text-ink-heading">Travel Operations Made Simple</h1>
          <p className="max-w-sm text-lg text-ink-secondary">
            Manage bookings, customers and operations, all in one place with TripNexio.
          </p>
          <span className="h-1 w-14 rounded-full bg-accent" aria-hidden="true" />
          <ul className="flex flex-col gap-5">
            {highlights.map(({ title, detail, Icon }) => (
              <li key={title} className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-1/80 text-accent-on-light shadow-[var(--shadow-glass-1)] ring-1 ring-glass-border">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-ink-heading">{title}</span>
                  <span className="text-sm text-ink-tertiary">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <GlassCard tier={3} className="mx-auto flex w-full max-w-[30rem] flex-col gap-5 rounded-3xl p-6 sm:p-9">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo size="lg" />
            <p className="text-lg font-medium text-ink-heading">TripNexio Internal Dashboard</p>
          </div>
          {google ? (
            <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
              {google === "no-account"
                ? "That Google account doesn't match an active staff account. Ask an admin, or sign in with your password."
                : "Google sign-in didn't complete. Please try again."}
            </p>
          ) : null}
          <StaffLoginForm redirectTo={from} googleEnabled={isGoogleSignInConfigured()} />
        </GlassCard>
      </Container>
    </section>
  );
}
