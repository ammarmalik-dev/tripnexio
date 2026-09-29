import { BadgeCheck, Loader, FileText, Send, RotateCcw, Ban, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

interface Stage {
  title: string;
  body: string;
  icon: LucideIcon;
}

// Locked content — UAE Visa Extension page doc §10 "After Payment".
const afterPayment: Stage[] = [
  { title: "Payment Received", body: "Your payment is confirmed.", icon: BadgeCheck },
  { title: "Extension Processing", body: "The paid extension process begins.", icon: Loader },
  { title: "Extended Visa Ready", body: "The new extended visa copy is received.", icon: FileText },
  {
    title: "Visa Delivered",
    body: "The extended visa is delivered through the available customer communication channels.",
    icon: Send,
  },
];

// Locked content — doc §11 "Outcomes". Kept as two distinct labels on purpose.
const outcomes: Stage[] = [
  { title: "Not Accepted", body: "Applicable refund: payment minus gateway charges.", icon: RotateCcw },
  { title: "Rejected", body: "Formal rejection follows the current no-refund rule.", icon: Ban },
];

export function AfterPaymentOutcomesSection() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-16">
        <div className="flex flex-col gap-10">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="What happens next" title="After payment" className="mx-auto" />
          </MotionReveal>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {afterPayment.map(({ title, body, icon: Icon }, index) => (
              <li key={title}>
                <MotionReveal delay={index * 0.05} className="h-full">
                  <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold text-ink-muted" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-ink-heading">{title}</h3>
                    <p className="text-sm text-ink-secondary">{body}</p>
                  </GlassCard>
                </MotionReveal>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-10">
          <MotionReveal>
            <SectionHeading
              align="center"
              eyebrow="Outcomes"
              title="If your extension isn't approved"
              description="The detailed refund rules are set out in our Refund & Cancellation Policy and FAQ."
              className="mx-auto"
            />
          </MotionReveal>
          <ul className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            {outcomes.map(({ title, body, icon: Icon }, index) => (
              <li key={title}>
                <MotionReveal delay={index * 0.06} className="h-full">
                  <GlassCard tier={2} className="flex h-full items-start gap-4 p-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-secondary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-semibold text-ink-heading">{title}</h3>
                      <p className="text-sm text-ink-secondary">{body}</p>
                    </div>
                  </GlassCard>
                </MotionReveal>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
