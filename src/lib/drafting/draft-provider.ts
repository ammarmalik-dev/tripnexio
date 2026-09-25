import type { DraftType } from "./draft-types";

export interface DraftRequest {
  draftType: DraftType;
  channel: "EMAIL" | "WHATSAPP";
  /** Plain-text, real-data-only summary built server-side — see build-lead-context.ts. Never contains invented data. */
  recordContext: string;
  /** Optional free-text guidance from staff (e.g. "mention their travel date is next week"). */
  instructions?: string;
  /** When set, the provider revises/improves/corrects this instead of starting fresh — the "improves, or corrects" half of the roadmap ask. */
  existingBody?: string;
}

export interface DraftResult {
  /** Always null for WHATSAPP — that channel has no subject line. */
  subject: string | null;
  body: string;
}

/**
 * Step 56 — its own interface, separate from whatsapp-bot's AiProvider and
 * ocr's OcrProvider, matching this codebase's established convention of one
 * interface per distinct AI job rather than one AI provider growing extra
 * methods per feature.
 */
export interface DraftProvider {
  readonly providerName: string;
  draft(request: DraftRequest): Promise<DraftResult>;
}
