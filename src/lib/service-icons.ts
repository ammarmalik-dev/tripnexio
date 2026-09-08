import { FileText, CalendarClock, ArrowLeftRight, Plane, TicketCheck, PlaneTakeoff, type LucideIcon } from "lucide-react";

/**
 * Fixed picklist of icons a Service row can reference (Step 6.2,
 * client-locked-spec roadmap). A bounded set rather than a free-text icon
 * name — an arbitrary string could reference a Lucide icon that doesn't
 * exist and silently render nothing; this way the Admin form can only pick
 * from icons this app actually imports and knows how to render.
 */
export const SERVICE_ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  CalendarClock,
  ArrowLeftRight,
  Plane,
  TicketCheck,
  PlaneTakeoff,
};

export const SERVICE_ICON_OPTIONS = Object.keys(SERVICE_ICON_MAP);
