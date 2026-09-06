import { z } from "zod";

export const assignLeadSchema = z.object({
  staffId: z.string().min(1).nullable(),
});

export type AssignLeadValues = z.infer<typeof assignLeadSchema>;
