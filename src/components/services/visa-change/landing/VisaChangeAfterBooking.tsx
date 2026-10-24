import { CloudUpload, LogOut, Receipt } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Locked content — doc §13 "Before Payment / After Payment" (customer POV). The wording is Admin-editable
// (Website Pages, "payment.cards"); the icons go by position.
const stageIcons = [Receipt, CloudUpload] as const;

/** Doc §13 "Before Payment / After Payment" + §14 "After Exit". */
export function VisaChangeAfterBooking({ content }: { content: SitePageContentView }) {
  const paymentStages = content.list("payment.cards", 2).map(([title, description], index) => ({
    title,
    description,
    Icon: stageIcons[index % stageIcons.length],
  }));
  return (
    <>
      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-8">
          <MotionReveal>
            <SectionHeading align="center" title={content.text("payment.heading")} className="mx-auto" />
          </MotionReveal>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {paymentStages.map(({ title, description, Icon }, index) => (
              <MotionReveal key={`${index}-${title}`} delay={index * 0.06}>
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
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container>
          <MotionReveal>
            <GlassCard tier={1} className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-heading sm:text-3xl">
                {content.text("afterExit.heading")}
              </h2>
              <p className="max-w-2xl text-sm text-ink-secondary sm:text-base">
                {content.text("afterExit.body")}
              </p>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
