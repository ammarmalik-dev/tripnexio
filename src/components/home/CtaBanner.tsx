import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { headerActions, utilityLinks } from "@/lib/nav-config";

export function CtaBanner() {
  return (
    <section className="pb-20 sm:pb-28">
      <Container>
        <MotionReveal>
          <GlassCard
            tier={3}
            className="flex flex-col items-center gap-6 bg-[image:var(--gradient-accent)] p-8 text-center sm:p-12"
          >
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Ready to simplify your journey?
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink
                href={headerActions.getStarted.href}
                variant="glass"
                size="lg"
                className="border-white/40 bg-white/10 text-white hover:border-white/60"
              >
                Browse Services
              </ButtonLink>
              <ButtonLink
                href={utilityLinks.trackStatus.href}
                variant="ghost"
                size="lg"
                className="border-white/50 text-white hover:border-white"
              >
                Track Status
              </ButtonLink>
            </div>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
