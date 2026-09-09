import { z } from "zod";
import { TaskStatus, type TaskStatus as TaskStatusType } from "../../generated/prisma/enums";

const taskStatusValues = Object.values(TaskStatus) as [TaskStatusType, ...TaskStatusType[]];

export const updateTaskStatusSchema = z.object({
  status: z.enum(taskStatusValues, { error: "Select a valid task status" }),
  note: z.string().trim().min(1).optional(),
});

export const updateTaskAssignmentSchema = z.object({
  assignedToId: z.string().trim().min(1).nullable(),
});

export type UpdateTaskStatusValues = z.infer<typeof updateTaskStatusSchema>;
export type UpdateTaskAssignmentValues = z.infer<typeof updateTaskAssignmentSchema>;
