import { MotionReveal } from "@/components/motion/MotionReveal";

export interface VisaProcessStep {
  step: string;
  headline: string;
  supportingCopy: string;
}

interface VisaProcessStepsProps {
  steps: VisaProcessStep[];
  /**
   * Locked copy for the doc's "OPTIONAL LIVE STATUS CARD" — always shown as
   * a clearly illustrative sample state (never wired to a real booking),
   * same convention as the homepage's `TrackJourneyPreview` sample stepper.
   */
  sampleStatusText?: string;
}

/**
 * The client's locked "reference-style visual" for a service's process
 * section (Sep 2026 content docs, all 5 services): a curved/dotted route
 * connecting 4 numbered milestones, large short headlines, one supporting
 * line each, generous white space. Shared across services (New Visa,
 * Visa Extension, Visa Change, Flight Special Fare, Return Ticket) rather
 * than rebuilt per page — each just supplies its own 4 steps.
 *
 * The desktop wave path is purely decorative (aria-hidden) and drawn
 * separately from the step cards below it, rather than trying to anchor
 * curve control points to each card's exact position — much more robust
 * across viewport widths. Mobile drops the wave for a simple vertical
 * dashed connector, which reads better in a single column.
 */
export function VisaProcessSteps({ steps, sampleStatusText }: VisaProcessStepsProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Desktop decorative wave connecting the 4 milestones */}
      <svg
        viewBox="0 0 800 120"
        preserveAspectRatio="none"
        className="hidden h-16 w-full text-accent/35 sm:block"
        aria-hidden="true"
      >
        <path
          d="M60,50 C160,50 160,90 260,90 C360,90 360,50 460,50 C560,50 560,90 660,90 C700,90 720,80 740,60"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="8 8"
          strokeLinecap="round"
        />
      </svg>

      <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-4 sm:gap-6">
        {/* Mobile vertical dashed connector, behind the numbered circles column */}
        <div className="absolute top-6 bottom-6 left-[19px] w-0 border-l-2 border-dashed border-accent/35 sm:hidden" aria-hidden="true" />

        {steps.map((item, index) => (
          <MotionReveal key={item.step} delay={index * 0.08}>
            <div className="relative flex gap-4 sm:flex-col sm:items-center sm:gap-3 sm:text-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-accent)] text-sm font-bold text-white shadow-[0_6px_16px_rgb(62_111_219/0.3)]">
                {item.step}
              </span>
              <div className="flex flex-col gap-1 pt-1 sm:pt-0">
                <p className="text-base font-semibold text-ink-heading">{item.headline}</p>
                <p className="max-w-xs text-sm text-ink-tertiary">{item.supportingCopy}</p>
              </div>
            </div>
          </MotionReveal>
        ))}
      </div>

      {sampleStatusText ? (
        <MotionReveal delay={steps.length * 0.08}>
          <div className="mx-auto mt-4 inline-flex items-center gap-2.5 self-center rounded-full bg-surface-dark px-5 py-2.5 text-sm font-medium text-ink-on-dark-primary">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent-on-dark" aria-hidden="true" />
            {sampleStatusText}
          </div>
        </MotionReveal>
      ) : null}
    </div>
  );
}
