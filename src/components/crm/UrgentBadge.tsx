import { Zap } from "lucide-react";
import { urgentBadgeLabel } from "@/lib/crm/urgency";
import type { ServiceType } from "../../generated/prisma/enums";

/** P21 item 6 — "Urgent" flag for New Visa Express / urgent OTB requests (rule: src/lib/crm/urgency.ts). */
export function UrgentBadge({ serviceType }: { serviceType: ServiceType }) {
  const description = `Urgent request — ${urgentBadgeLabel(serviceType)} processing`;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error"
      title={description}
      aria-label={description}
    >
      <Zap className="h-3 w-3" aria-hidden="true" />
      Urgent
    </span>
  );
}
