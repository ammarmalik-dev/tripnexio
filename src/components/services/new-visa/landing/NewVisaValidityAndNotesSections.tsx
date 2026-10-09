import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

/** New Visa country page — "Important before you apply" checklist (doc §11). Nothing renders without items. */
export function NewVisaBeforeYouApplySection({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="py-10 sm:py-14">
      <Container>
        <MotionReveal>
          <GlassCard tier={2} className="mx-auto flex max-w-3xl flex-col gap-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-xl font-semibold text-ink-heading sm:text-2xl">Important before you apply</h2>
            </div>
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
