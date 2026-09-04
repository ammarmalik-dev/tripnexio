import { ClipboardList, FileCheck2, Send, Bell, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";

const steps = [
  {
    step: "01",
    title: "Tell Us",
    description: "Choose your service and share your project details.",
    icon: ClipboardList,
  },
  {
    step: "02",
    title: "We Verify",
    description: "TripNexio checks documents, requirements and availability.",
    icon: FileCheck2,
  },
  {
    step: "03",
    title: "Pay",
    description: "Review the summary and complete secure payment.",
    icon: Send,
  },
  {
    step: "04",
    title: "We Process",
    description: "Staff, vendor and authority processing happens through our CRM.",
    icon: Bell,
  },
  {
    step: "05",
    title: "Get Your Result",
    description: "Receive your visa, ticket, OTB or update via real-time tracking.",
    icon: ShieldCheck,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow="Simple steps. Powerful results."
            title="How TripNexio works"
            className="mx-auto"
          />
        </MotionReveal>

        <div className="relative grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-5">
          <div
            className="absolute left-[10%] right-[10%] top-6 hidden border-t border-dashed border-hairline sm:block"
            aria-hidden="true"
          />
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <MotionReveal key={step.title} delay={index * 0.06}>
                <div className="relative flex flex-col items-center gap-2 text-center">
                  <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="relative z-10 flex h-5 w-8 items-center justify-center rounded-sm bg-surface-dark text-[10px] font-semibold text-ink-on-dark-primary">
                    {step.step}
                  </span>
                  <p className="mt-1 text-sm font-semibold text-ink-heading">{step.title}</p>
                  <p className="text-xs text-ink-tertiary">{step.description}</p>
                </div>
              </MotionReveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
