export type TrackStageStatus = "done" | "current" | "upcoming";

export interface TrackStage {
  label: string;
  status: TrackStageStatus;
  date?: string;
}

export interface TrackResult {
  referenceId: string;
  service: string;
  applicantName: string;
  submittedDate: string;
  stages: TrackStage[];
}

/**
 * SAMPLE DATA ONLY — a small fixed set of demo records so the Track Status
 * page has something real to look up against with no backend yet (see
 * CLAUDE.md hard rule #1). Not real customer requests.
 */
const SAMPLE_TRACKING_RECORDS: Record<string, TrackResult> = {
  "NV-100234": {
    referenceId: "NV-100234",
    service: "New Visa",
    applicantName: "Ammar Ahmed",
    submittedDate: "2 October 2026",
    stages: [
      { label: "Request Received", status: "done", date: "2 Oct 2026" },
      { label: "Documents Validated", status: "done", date: "3 Oct 2026" },
      { label: "Processing with Embassy", status: "current" },
      { label: "Under Final Review", status: "upcoming" },
      { label: "Visa Issued", status: "upcoming" },
    ],
  },
  "OTB-100567": {
    referenceId: "OTB-100567",
    service: "OTB — Ok to Board",
    applicantName: "Sara Khan",
    submittedDate: "18 September 2026",
    stages: [
      { label: "Request Received", status: "done", date: "18 Sep 2026" },
      { label: "Airline Coordination", status: "done", date: "19 Sep 2026" },
      { label: "Authorization Confirmed", status: "done", date: "20 Sep 2026" },
      { label: "OTB Issued", status: "done", date: "20 Sep 2026" },
    ],
  },
  "VE-100987": {
    referenceId: "VE-100987",
    service: "Visa Extension",
    applicantName: "Imran Sheikh",
    submittedDate: "28 October 2026",
    stages: [
      { label: "Request Received", status: "done", date: "28 Oct 2026" },
      { label: "Documents Validated", status: "current" },
      { label: "Processing with Authority", status: "upcoming" },
      { label: "Extension Confirmed", status: "upcoming" },
    ],
  },
};

export const SAMPLE_TRACKING_IDS = Object.keys(SAMPLE_TRACKING_RECORDS);

/**
 * Frontend-only mock — resolves a fixed sample record for a known reference
 * ID (case/whitespace-insensitive), or null for anything else so the
 * not-found state has something real to trigger against. Swap for the real
 * lookup API in M2.
 */
export async function trackRequest(referenceId: string): Promise<TrackResult | null> {
  await new Promise((resolve) => setTimeout(resolve, 900));

  const normalized = referenceId.trim().toUpperCase();
  return SAMPLE_TRACKING_RECORDS[normalized] ?? null;
}
