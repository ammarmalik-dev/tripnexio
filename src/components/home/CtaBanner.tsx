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
            {/* Client 2026-10-14 — both buttons on one line on phones too. */}
            <div className="flex w-full max-w-sm items-center justify-center gap-2.5 sm:max-w-none sm:gap-3">
              <ButtonLink href={headerActions.getStarted.href} variant="primary" size="lg" className="h-11 min-w-0 flex-1 justify-center whitespace-nowrap px-3 text-sm sm:h-13 sm:flex-none sm:px-7 sm:text-base">
                Explore Services
              </ButtonLink>
              <ButtonLink
                href={utilityLinks.trackStatus.href}
                variant="ghost"
                size="lg"
                className="h-11 min-w-0 flex-1 justify-center whitespace-nowrap px-3 text-sm sm:h-13 sm:flex-none sm:px-7 sm:text-base border-white/40 text-white hover:border-white/70 hover:bg-white/5"
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
