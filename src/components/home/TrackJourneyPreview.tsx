import { CheckCircle2, Circle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { cn } from "@/lib/cn";
import { utilityLinks } from "@/lib/nav-config";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

type StageStatus = "done" | "current" | "upcoming";

const STAGE_STATUSES: readonly StageStatus[] = ["done", "current", "upcoming"];

/** Admin's "done / current / upcoming" word → how the stage is drawn (anything else = upcoming). */
function toStageStatus(value: string): StageStatus {
  const word = value.trim().toLowerCase();
  return STAGE_STATUSES.find((status) => status === word) ?? "upcoming";
}

export function TrackJourneyPreview({ content }: { content: SitePageContentView }) {
  // Client confirmation 2026-10-25 — the sample stages come from Admin → Website Pages.
  const stages = content.list("track.stages", 2).map(([label, status]) => ({ label, status: toStageStatus(status) }));
  return (
    <section className="py-8 sm:py-10">
      <Container>
        <MotionReveal>
          <div className="surface-dark-block flex flex-col gap-8 rounded-xl p-6 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
                  {content.text("track.title")}
                </h2>
                <p className="text-sm text-ink-on-dark-secondary">
                  {content.text("track.intro")}
                </p>
              </div>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="primary" size="md">
                {content.text("track.buttonLabel")}
              </ButtonLink>
            </div>

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div
                className="absolute left-0 right-0 top-4 hidden h-px bg-hairline-on-dark sm:block"
                aria-hidden="true"
              />
              {stages.map((stage, index) => (
                <div
                  key={`${index}-${stage.label}`}
                  className="relative z-10 flex flex-1 flex-row items-center gap-3 sm:flex-col sm:items-center sm:text-center"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      stage.status === "done" && "bg-success text-white",
                      stage.status === "current" &&
                        "bg-[image:var(--gradient-accent)] text-white shadow-[0_8px_20px_-6px_rgb(62_111_219_/_60%)]",
                      stage.status === "upcoming" && "border border-hairline-on-dark text-ink-on-dark-muted"
                    )}
                  >
                    {stage.status === "upcoming" ? (
                      <Circle className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      stage.status === "upcoming"
                        ? "text-ink-on-dark-tertiary"
                        : "text-ink-on-dark-primary"
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </MotionReveal>
      </Container>
    </section>
  );
}
