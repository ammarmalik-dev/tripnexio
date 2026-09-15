import { z } from "zod";

export const reuseDocumentSchema = z.object({
  /** Where the reused copy should attach — at least one of these two. */
  bookingId: z.string().trim().min(1).optional(),
  passengerId: z.string().trim().min(1).optional(),
});

export type ReuseDocumentValues = z.infer<typeof reuseDocumentSchema>;
