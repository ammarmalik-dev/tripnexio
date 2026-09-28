import { Sparkles, Headset, Eye, CalendarCheck, ShieldCheck, Headphones } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";

// Locked copy — Homepage_FINAL_Locked_1of1.docx §7. Do not replace these with
// AI/automation-led benefit claims on the homepage unless separately approved.
const reasons = [
  {
    title: "Simple Process",
    description: "Easy steps from request to completion.",
    icon: Sparkles,
  },
  {
    title: "Guided Support",
    description: "Get help throughout your journey.",
    icon: Headset,
  },
  {
    title: "Clear & Transparent",
    description: "Know your service, pricing and next steps clearly.",
    icon: Eye,
  },
  {
    title: "Easy Tracking",
    description: "Stay updated on your application or booking.",
    icon: CalendarCheck,
  },
  {
    title: "Secure Payments",
    description: "Complete payments through a secure process.",
    icon: ShieldCheck,
  },
  {
    title: "Human Support",
    description: "Our team is here when you need assistance.",
    icon: Headphones,
  },
];

export function WhyChooseUs() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <MotionReveal>
          <SectionHeading eyebrow="Why TripNexio" title="A Simpler Way to Travel" />
        </MotionReveal>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {reasons.map((reason, index) => {
            const Icon = reason.icon;
            return (
              <MotionReveal key={reason.title} delay={index * 0.05}>
                <div className="flex flex-col gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-ink-heading">{reason.title}</p>
                  <p className="text-xs text-ink-tertiary">{reason.description}</p>
                </div>
              </MotionReveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
