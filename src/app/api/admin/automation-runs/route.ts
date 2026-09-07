import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { AUTOMATION_WORKFLOWS } from "@/lib/automation/workflows";

/** Powers the Admin "Automation" monitoring screen — last run per known workflow (even ones that have never run) plus a combined recent-history list. */
export async function GET() {
  const auth = await requirePermission("automation.view");
  if (auth.error) return auth.error;

  const workflows = await Promise.all(
    AUTOMATION_WORKFLOWS.map(async (workflow) => {
      const lastRun = await db.automationRun.findFirst({
        where: { workflowKey: workflow.key },
        orderBy: { createdAt: "desc" },
      });
      return { ...workflow, lastRun };
    })
  );

  const recentRuns = await db.automationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return jsonSuccess({ workflows, recentRuns });
}
