import { CloudUpload, LogOut, Receipt } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

// Locked content — doc §13 "Before Payment / After Payment" (customer POV).
const paymentStages = [
  {
    title: "Before payment",
    description:
      "You see the confirmed package, final rate, terms and summary. Payment is then completed.",
    Icon: Receipt,
  },
  {
    title: "After payment",
    description:
      "Your Booking ID is generated, you can upload required documents, and package generation proceeds once operational requirements are complete.",
    Icon: CloudUpload,
  },
] as const;

/** Doc §13 "Before Payment / After Payment" + §14 "After Exit". */
export function VisaChangeAfterBooking() {
  return (
    <>
      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10">
          <MotionReveal>
            <SectionHeading align="center" title="Before payment / After payment" className="mx-auto" />
          </MotionReveal>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {paymentStages.map(({ title, description, Icon }, index) => (
              <MotionReveal key={title} delay={index * 0.06}>
                <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6 sm:p-8">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-semibold text-ink-heading">{title}</h3>
                  <p className="text-sm text-ink-secondary sm:text-base">{description}</p>
                </GlassCard>
              </MotionReveal>
            ))}
          </div>
          <MotionReveal>
            <p className="text-center text-sm text-ink-tertiary">
              Example Booking ID: <span className="font-mono font-semibold text-ink-secondary">TNX-VC-XXXXXX</span>
            </p>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <MotionReveal>
            <GlassCard tier={1} className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-heading sm:text-3xl">
                Exit completed. What happens next?
              </h2>
              <p className="max-w-2xl text-sm text-ink-secondary sm:text-base">
                Once the confirmed exit is completed, TripNexio records the exit and starts New Visa Processing.
                Additional documents may be requested during the next stage if required.
              </p>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
