import type { ReactNode } from "react";
import { CheckCircle2, ClipboardList, FileCheck2, FileText, Info } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

export interface RequirementItem {
  label: string;
  /** Short caption under the label, e.g. "Required" or "Optional / where applicable". */
  detail?: string;
}

export interface RequiredDocument {
  name: string;
  required: boolean;
  /** Overrides the default "Required" / "Where applicable" caption. */
  caption?: string;
}

interface ServiceRequirementsSectionProps {
  whatYouNeed: RequirementItem[];
  documents: RequiredDocument[];
  /** Shown under both cards, e.g. "Additional documents may be required…". */
  notes?: string[];
}

/**
 * One "What You'll Need" + "Documents Required" layout for every service page
 * (client correction 2026-10-05: same layout, alignment and spacing across all
 * services and New Visa countries). Two equal cards side by side on desktop,
 * stacked on mobile; a side with no items is left out.
 */
export function ServiceRequirementsSection({ whatYouNeed, documents, notes = [] }: ServiceRequirementsSectionProps) {
  if (whatYouNeed.length === 0 && documents.length === 0) return null;
  const bothSides = whatYouNeed.length > 0 && documents.length > 0;

  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-5">
        <div className={bothSides ? "grid grid-cols-1 gap-5 lg:grid-cols-2" : "mx-auto w-full max-w-3xl"}>
          {whatYouNeed.length > 0 ? (
            <MotionReveal className="h-full">
              <RequirementsCard title="What You'll Need" icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}>
                {whatYouNeed.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-ink-heading">{item.label}</span>
                      {item.detail ? <span className="text-sm text-ink-secondary">{item.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </RequirementsCard>
            </MotionReveal>
          ) : null}

          {documents.length > 0 ? (
            <MotionReveal delay={0.06} className="h-full">
              <RequirementsCard title="Documents Required" icon={<FileCheck2 className="h-5 w-5" aria-hidden="true" />}>
                {documents.map((doc) => (
                  <li key={doc.name} className="flex items-start gap-2.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent-on-light" aria-hidden="true" />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-ink-heading">{doc.name}</span>
                      <span className="text-sm text-ink-secondary">
                        {doc.caption ?? (doc.required ? "Required" : "Where applicable")}
                      </span>
                    </span>
                  </li>
                ))}
              </RequirementsCard>
            </MotionReveal>
          ) : null}
        </div>

        {notes.length > 0 ? (
          <MotionReveal>
            <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-on-light" aria-hidden="true" />
              <div className="flex flex-col gap-1.5 text-sm text-ink-secondary">
                {notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
          </MotionReveal>
        ) : null}
      </Container>
    </section>
  );
}

function RequirementsCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
          {icon}
        </span>
        <h2 className="text-lg font-semibold text-ink-heading">{title}</h2>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</ul>
    </GlassCard>
  );
}
