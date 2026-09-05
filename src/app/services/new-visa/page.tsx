import type { Metadata } from "next";
import { FileText, ShieldCheck, Clock, ClipboardList, MessageSquareText, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";

export const metadata: Metadata = {
  title: "New Visa",
  description:
    "Apply for a new UAE or GCC visa online — submit your travel details in a few guided steps and our team takes it from there.",
};

const whatYoullNeed = [
  "Full name",
  "Mobile number",
  "Email address",
  "Destination country",
  "Visa type",
  "Number of travelers",
  "Travel date",
  "Processing type — Normal or Urgent",
];

const howItWorks = [
  {
    title: "Tell us your travel plans",
    description: "Share your destination, visa type, and travel date.",
    icon: MessageSquareText,
  },
  {
    title: "We process your application",
    description: "Our team coordinates with the relevant embassy or vendor.",
    icon: ShieldCheck,
  },
  {
    title: "Get your visa confirmation",
    description: "Receive your new visa confirmation ahead of departure.",
    icon: CheckCircle2,
  },
];

export default function NewVisaLandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <GradientMesh />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              New Visa
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Apply for a new UAE or GCC visa with our simple, guided
              process. Submit your travel details online — our team handles
              the coordination with the embassy or vendor from there.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/services/new-visa/request" variant="primary" size="lg">
                Start New Visa Request
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
              <SectionHeading eyebrow="What is a New Visa request?" title="Your visa application, guided end to end" />
              <p className="text-sm text-ink-secondary sm:text-base">
                Applying for a UAE or GCC visa involves choosing the right
                visa type, submitting accurate travel details, and tracking
                progress with the issuing authority. TripNexio submits and
                tracks your request on your behalf, so you get a clear,
                guided process instead of navigating it yourself.
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
                Ready to apply for your visa?
              </h2>
              <ButtonLink href="/services/new-visa/request" variant="primary" size="lg">
                Start New Visa Request
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
