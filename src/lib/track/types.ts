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
  /** The service's own customer-facing steps (P08), or the generic 5 stages when none apply. Empty when `closedMessage` is set. */
  stages: TrackStage[];
  /** P09 — service results already delivered (download from the emailed/WhatsApp link or the account page). */
  delivered?: { label: string; deliveredDate: string }[];
  /** P12 — New Visa: each passenger's (masked) visa status beside their Protection Plan status (null = not chosen). */
  passengers?: { name: string; visaStatus: string; protectionPlan: string | null }[];
  /** Set only for a terminal-negative status (Lead LOST/CLOSED, Booking CANCELLED/REFUNDED) — shown instead of the stage timeline. */
  closedMessage?: string;
}
