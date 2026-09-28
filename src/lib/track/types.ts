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
  /** Empty when `closedMessage` is set — a closed/cancelled/refunded request doesn't fit the 5-stage progress scale. */
  stages: TrackStage[];
  /** Set only for a terminal-negative status (Lead LOST/CLOSED, Booking CANCELLED/REFUNDED) — shown instead of the stage timeline. */
  closedMessage?: string;
}
