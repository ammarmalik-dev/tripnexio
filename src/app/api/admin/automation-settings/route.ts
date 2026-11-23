import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { AUTOMATIONS, automationDefinition } from "@/lib/automation/settings";

type ChannelState = "ON" | "OFF" | "MIXED" | "NONE";

/** On when every template row of the channel is active, off when none is, NONE when no template exists. */
function channelState(rows: { channel: string; active: boolean }[], channel: "EMAIL" | "WHATSAPP"): ChannelState {
  const list = rows.filter((row) => row.channel === channel);
  if (list.length === 0) return "NONE";
  if (list.every((row) => row.active)) return "ON";
  return list.some((row) => row.active) ? "MIXED" : "OFF";
}

/** Client doc 16 Nov (N1) — every automation with its on / off and its customer channels (from its templates). */
export async function GET() {
  const auth = await requirePermission("automation.view");
  if (auth.error) return auth.error;
  const [settings, templates] = await Promise.all([
    db.automationSetting.findMany(),
    db.notificationTemplate.findMany({ where: { event: { in: AUTOMATIONS.flatMap((automation) => automation.events) } }, select: { event: true, channel: true, active: true } }),
  ]);
  return jsonSuccess(
    AUTOMATIONS.map((automation) => {
      const rows = templates.filter((row) => automation.events.includes(row.event));
      return {
        key: automation.key,
        label: automation.label,
        description: automation.description,
        audience: automation.audience,
        events: automation.events,
        enabled: settings.find((row) => row.key === automation.key)?.enabled ?? automation.defaultEnabled,
        email: automation.audience === "CUSTOMER" ? channelState(rows, "EMAIL") : "NONE",
        whatsapp: automation.audience === "CUSTOMER" ? channelState(rows, "WHATSAPP") : "NONE",
      };
    })
  );
}

const patchSchema = z.union([
  z.object({ key: z.string().min(1), enabled: z.boolean() }),
  z.object({ key: z.string().min(1), channel: z.enum(["EMAIL", "WHATSAPP"]), active: z.boolean() }),
]);

/** Switch an automation on / off, or one of its channels (its templates' `active`). Audited. */
export async function PATCH(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the request.");
  const automation = automationDefinition(parsed.data.key);
  if (!automation) return jsonError(404, "Unknown automation.");

  await db.$transaction(async (tx) => {
    if ("enabled" in parsed.data) {
      const enabled = parsed.data.enabled;
      await tx.automationSetting.upsert({ where: { key: automation.key }, create: { key: automation.key, enabled }, update: { enabled } });
      await writeAudit(tx, { entityType: "AutomationSetting", entityId: automation.key, action: "UPDATE", byUserId: session.id, note: `${automation.label} switched ${enabled ? "on" : "off"} (by ${session.name})` });
    } else {
      const { channel, active } = parsed.data;
      await tx.notificationTemplate.updateMany({ where: { event: { in: automation.events }, channel }, data: { active } });
      await writeAudit(tx, {
        entityType: "AutomationSetting",
        entityId: automation.key,
        action: "UPDATE",
        byUserId: session.id,
        note: `${automation.label}: ${channel === "EMAIL" ? "Email" : "WhatsApp"} ${active ? "on" : "off"} (by ${session.name})`,
      });
    }
  });
  return jsonSuccess({ ok: true });
}
