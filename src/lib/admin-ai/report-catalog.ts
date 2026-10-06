import { REPORTS } from "@/lib/reports/registry";

/** The Finance/MIS report keys + titles, listed in the AI classifier prompt so it can pick one (RUN_REPORT). */
export const REPORT_KEYS_FOR_PROMPT = REPORTS.map((report) => `${report.key} (${report.title})`).join(", ");
