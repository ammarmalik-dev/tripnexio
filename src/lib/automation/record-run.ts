import { db } from "../db";

/**
 * Wraps every /api/automation/* job so a run's outcome is always recorded
 * for the Admin monitoring screen to read — one AutomationRun row per
 * invocation, whether it succeeds or throws. `workflowKey` must match the
 * corresponding n8n workflow's key (see src/lib/automation/workflows.ts).
 */
export async function recordAutomationRun<T extends Record<string, unknown>>(workflowKey: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = new Date();
  try {
    const summary = await fn();
    await db.automationRun.create({
      data: { workflowKey, status: "SUCCESS", summary: summary as object, startedAt, finishedAt: new Date() },
    });
    return summary;
  } catch (error) {
    await db.automationRun.create({
      data: {
        workflowKey,
        status: "FAILURE",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        startedAt,
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}
