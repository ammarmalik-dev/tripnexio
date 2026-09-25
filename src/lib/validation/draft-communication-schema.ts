import { z } from "zod";
import { DRAFT_TYPES } from "@/lib/drafting/draft-types";

export const draftCommunicationSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  draftType: z.enum(DRAFT_TYPES),
  instructions: z.string().trim().max(500).optional(),
  /** Present when the staff member is asking to improve/correct what they've already written, rather than draft fresh. */
  existingBody: z.string().trim().max(10000).optional(),
});

export type DraftCommunicationValues = z.infer<typeof draftCommunicationSchema>;
