import type { ReactNode } from "react";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { GlassCard } from "@/components/ui/GlassCard";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/layout/Logo";
import { MotionReveal } from "@/components/motion/MotionReveal";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Shared centered glass-card chrome for the login and register pages. */
export function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <GradientMesh />
      <Container className="relative flex justify-center">
        <MotionReveal className="w-full max-w-md">
          <GlassCard tier={2} className="flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <Logo />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium tracking-wide text-ink-accent">{eyebrow}</span>
                <h1 className="text-2xl font-semibold tracking-tight text-ink-heading sm:text-3xl">{title}</h1>
                <p className="text-sm text-ink-secondary">{subtitle}</p>
              </div>
            </div>
            {children}
          </GlassCard>
          {footer ? <div className="mt-6 text-center text-sm text-ink-secondary">{footer}</div> : null}
        </MotionReveal>
      </Container>
    </section>
  );
}
