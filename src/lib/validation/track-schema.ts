import { z } from "zod";

export const trackSchema = z.object({
  referenceId: z
    .string()
    .trim()
    .min(3, "Enter a booking or reference ID"),
});

export type TrackValues = z.infer<typeof trackSchema>;
