import { getServiceTimelineRules } from "../settings/service-timeline-config";
import { DEFAULT_MIN_TRAVEL_DAYS, type NewVisaTravelRules } from "./products";

/** The Admin-configured New Visa minimum-days rule (Timelines / SLA), falling back to 7 / 3 working days. */
export async function getNewVisaTravelRules(): Promise<NewVisaTravelRules> {
  const timeline = await getServiceTimelineRules("NEW_VISA");
  return {
    minTravelDaysNormal: timeline.minTravelDaysNormal ?? DEFAULT_MIN_TRAVEL_DAYS.normal,
    minTravelDaysExpress: timeline.minTravelDaysExpress ?? DEFAULT_MIN_TRAVEL_DAYS.urgent,
    processingDaysNormal: timeline.processingDaysNormal,
    processingDaysExpress: timeline.processingDaysExpress,
  };
}
