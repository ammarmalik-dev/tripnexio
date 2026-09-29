import { FileCheck2, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

export interface ReturnTicketLandingDocument {
  name: string;
  required: boolean;
}

// Locked content — RVT Page Content v3 §7. Used verbatim when an Admin row's
// name matches one of the doc's three documents, and as the whole list when
// the Admin checklist can't be read.
const DOC_CAPTIONS: Record<string, string> = {
  "passport copy": "Required",
  "return ticket": "Provide existing ticket details where applicable",
  "visa copy": "Optional / where applicable",
};

const FALLBACK_DOCUMENTS: ReturnTicketLandingDocument[] = [
  { name: "Passport Copy", required: true },
  { name: "Return Ticket", required: false },
  { name: "Visa Copy", required: false },
];

function captionFor(doc: ReturnTicketLandingDocument): string {
  return DOC_CAPTIONS[doc.name.trim().toLowerCase()] ?? (doc.required ? "Required" : "Where applicable");
}

/**
 * P19 — "Documents required". `documents` is the Admin-managed
 * DocumentRequirement checklist for RETURN_TICKET (null when it couldn't be
 * loaded, in which case the doc's own list is shown).
 */
export function DocumentsRequiredSection({ documents }: { documents: ReturnTicketLandingDocument[] | null }) {
  const list = documents && documents.length > 0 ? documents : FALLBACK_DOCUMENTS;
  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <MotionReveal>
          <SectionHeading align="center" title="Documents required" className="mx-auto" />
        </MotionReveal>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((doc, index) => (
            <li key={doc.name} className="h-full">
              <MotionReveal delay={index * 0.05} className="h-full">
                <GlassCard tier={2} className="flex h-full items-start gap-3 p-5 sm:p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    {doc.required ? (
                      <FileCheck2 className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold text-ink-heading">{doc.name}</p>
                    <p className="text-sm text-ink-secondary">{captionFor(doc)}</p>
                  </div>
                </GlassCard>
              </MotionReveal>
            </li>
          ))}
        </ul>
        <MotionReveal>
          <p className="mx-auto max-w-2xl text-center text-sm text-ink-tertiary">
            Additional information or documents may be requested when necessary for the selected destination,
            airline/partner or reservation process.
          </p>
        </MotionReveal>
      </Container>
    </section>
  );
}
