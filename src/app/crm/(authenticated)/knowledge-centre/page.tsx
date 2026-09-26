import type { Metadata } from "next";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";
import { KnowledgeCentreManager } from "@/components/crm/KnowledgeCentreManager";

export const metadata: Metadata = { title: "Knowledge Centre | Internal Dashboard" };

export default async function KnowledgeCentrePage() {
  const session = await getStaffSession();
  const canEdit = hasPermission(session, "knowledge.edit");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Knowledge Centre</h1>
        <p className="text-sm text-ink-tertiary">SOPs/documentation, an internal staff FAQ, and training material — search or browse by category.</p>
      </div>
      <KnowledgeCentreManager canEdit={canEdit} />
    </div>
  );
}
