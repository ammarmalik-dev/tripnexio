import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { headerActions, utilityLinks } from "@/lib/nav-config";

export function CtaBanner() {
  return (
    <section className="">
      <Container>
        <MotionReveal>
          <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
              Ready to simplify your journey?
            </h2>
            {/* Client testing 2026-10-09 (B2) — full-width, stacked buttons on phones. */}
            <div className="flex w-full max-w-xs flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
              <ButtonLink href={headerActions.getStarted.href} variant="primary" size="lg" className="justify-center">
                Explore Services
              </ButtonLink>
              <ButtonLink
                href={utilityLinks.trackStatus.href}
                variant="ghost"
                size="lg"
                className="justify-center border-white/40 text-white hover:border-white/70 hover:bg-white/5"
              >
                Track Status
              </ButtonLink>
            </div>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
