import { db } from "../db";
import { sendSystemAlert } from "./system-alert";

/**
 * Wraps every /api/automation/* job so a run's outcome is always recorded
 * for the Admin monitoring screen to read — one AutomationRun row per
 * invocation, whether it succeeds or throws. `workflowKey` must match the
 * corresponding n8n workflow's key (see src/lib/automation/workflows.ts).
 *
 * Step 45 — a FAILURE also fires sendSystemAlert() (a plain email to
 * SystemConfig.systemAlertEmail, when set) before re-throwing, so a
 * failed job doesn't sit unnoticed until someone visits the Admin
 * monitoring screen.
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db.automationRun.create({
      data: { workflowKey, status: "FAILURE", errorMessage, startedAt, finishedAt: new Date() },
    });
    await sendSystemAlert(`Automation job "${workflowKey}" failed`, `The "${workflowKey}" automation job failed at ${new Date().toISOString()}: ${errorMessage}`);
    throw error;
  }
}
