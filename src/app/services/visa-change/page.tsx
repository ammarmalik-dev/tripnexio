import type { Metadata } from "next";
import { ArrowLeftRight, ShieldCheck, Clock, ClipboardList, MessageSquareText, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";

export const metadata: Metadata = {
  title: "Visa Change",
  description:
    "Change your UAE visa status — Airport-to-Airport or Border Exit, confirmed by our team. Submit your details online and we handle the rest.",
};

const whatYoullNeed = [
  "Full name",
  "Passport number",
  "Visa last date",
  "Mobile number",
  "Email address",
  "Nationality",
];

const howItWorks = [
  {
    title: "Choose your method",
    description: "Airport-to-Airport or Border Exit — no need to pick a specific airport or border.",
    icon: MessageSquareText,
  },
  {
    title: "We confirm availability",
    description: "Our team checks with the relevant sponsor/partner and confirms your options.",
    icon: ShieldCheck,
  },
  {
    title: "Select your package",
    description: "Choose your confirmed date, time, and package — pricing is shown then.",
    icon: CheckCircle2,
  },
];

export default function VisaChangeLandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <GradientMesh />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <ArrowLeftRight className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              Visa Change
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Change or exit your visa status — Airport-to-Airport or Border Exit. Submit your details online — our
              team confirms availability and handles the process from there.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/services/visa-change/request" variant="primary" size="lg">
                Start Visa Change Request
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                Track Status
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <MotionReveal>
            <div className="flex flex-col gap-4">
              <SectionHeading eyebrow="How airports and borders work" title="You never pick the airport or border" />
              <p className="text-sm text-ink-secondary sm:text-base">
                You choose only the method — Airport-to-Airport or Border Exit. Our team confirms the exact airport
                or border crossing, along with all pickup and reporting details, and you&apos;ll only see confirmed
                options to choose from.
              </p>
            </div>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-base font-semibold text-ink-heading">What you&rsquo;ll need</p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {whatYoullNeed.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-12">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How it works" className="mx-auto" />
          </MotionReveal>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {howItWorks.map((step, index) => {
              const Icon = step.icon;
              return (
                <MotionReveal key={step.title} delay={index * 0.08}>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold text-ink-heading">{step.title}</p>
                    <p className="max-w-xs text-xs text-ink-tertiary">{step.description}</p>
                  </div>
                </MotionReveal>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="pb-20 sm:pb-28">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
                Ready to change your visa?
              </h2>
              <ButtonLink href="/services/visa-change/request" variant="primary" size="lg">
                Start Visa Change Request
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
