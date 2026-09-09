import { cn } from "@/lib/cn";
import { LEAD_TEMPERATURE_LABELS } from "@/lib/crm/labels";
import type { LeadTemperature } from "../../generated/prisma/enums";

const TEMPERATURE_STYLES: Record<LeadTemperature, string> = {
  HOT: "bg-error/10 text-error",
  WARM: "bg-warning/10 text-warning",
  COLD: "bg-accent/10 text-accent-on-light",
};

export function LeadTemperatureBadge({ temperature }: { temperature: LeadTemperature | null }) {
  if (!temperature) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-ink-primary/[0.05] px-2.5 py-1 text-xs font-medium text-ink-tertiary">
        Not set
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        TEMPERATURE_STYLES[temperature]
      )}
    >
      {LEAD_TEMPERATURE_LABELS[temperature]}
    </span>
  );
}
