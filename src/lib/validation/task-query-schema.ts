import { z } from "zod";
import { TaskStatus, TaskType, TaskPriority, type TaskStatus as TaskStatusType, type TaskType as TaskTypeType, type TaskPriority as TaskPriorityType } from "../../generated/prisma/enums";

const taskStatusValues = Object.values(TaskStatus) as [TaskStatusType, ...TaskStatusType[]];
const taskTypeValues = Object.values(TaskType) as [TaskTypeType, ...TaskTypeType[]];
const taskPriorityValues = Object.values(TaskPriority) as [TaskPriorityType, ...TaskPriorityType[]];

export const taskListQuerySchema = z.object({
  status: z.enum(taskStatusValues).optional(),
  type: z.enum(taskTypeValues).optional(),
  priority: z.enum(taskPriorityValues).optional(),
  /** "unassigned" is a sentinel for assignedToId IS NULL — a real staff id filters to that assignee. */
  assignedToId: z.string().trim().min(1).optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc", "dueDate_asc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type TaskListQueryValues = z.infer<typeof taskListQuerySchema>;
