import { ServiceRequirementsSection } from "@/components/services/ServiceRequirementsSection";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

/**
 * Doc §8 "What You'll Need" and §9 "Documents Required", in the shared service layout. Locked content: client
 * correction 2026-10-05 (visa expiry date, no eligibility block) and client testing 2026-10-09 (B22/B23 — the
 * document list, uploaded after payment; only the visa copy is asked before payment, in the request form).
 * All Admin-editable (Website Pages, "requirements.*").
 */
export function VisaChangeRequirements({ content }: { content: SitePageContentView }) {
  const whatYoullNeed = content.list("requirements.items", 2).map(([label, detail]) => ({ label, detail: detail || undefined }));
  const documents = content.list("requirements.documents", 3).map(([name, caption, flag]) => ({
    name,
    required: flag.toLowerCase() !== "optional",
    caption: caption || undefined,
  }));
  const notes = content.list("requirements.notes").map(([note]) => note);

  return (
    <ServiceRequirementsSection
      whatYouNeed={whatYoullNeed}
      documents={documents}
      notes={notes}
      needTitle={content.text("requirements.needTitle")}
      documentsTitle={content.text("requirements.documentsTitle")}
    />
  );
}
