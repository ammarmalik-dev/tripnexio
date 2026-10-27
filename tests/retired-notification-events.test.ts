import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_EVENTS } from "../src/lib/notifications/events";
import { RETIRED_NOTIFICATION_EVENTS, isRetiredNotificationEvent, templateGroupFor } from "../src/lib/notifications/template-groups";
import { STATUS_CATALOG } from "../src/lib/service-status/catalog";
import templates from "../src/lib/service-status/template-catalog.json";

/** Every .ts / .tsx source file under src (not the generated Prisma client). */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const SKIP = [join("src", "lib", "notifications", "events.ts"), join("src", "lib", "notifications", "template-groups.ts")];
const sources = sourceFiles("src")
  .filter((path) => !SKIP.some((skip) => path.endsWith(skip)))
  .map((path) => ({ path, text: readFileSync(path, "utf8") }));

/** True when some source sends this event: `NOTIFICATION_EVENTS.X` or an `event: "X"` literal. */
function isSent(event: string): boolean {
  const constant = new RegExp(`NOTIFICATION_EVENTS\\.${event}\\b`);
  const literal = new RegExp(`event:\\s*"${event}"`);
  return sources.some(({ text }) => constant.test(text) || literal.test(text));
}

describe("retired legacy notification templates (client 2026-10-28)", () => {
  it("no code path sends a retired event, and no status of the client's lists notifies with one", () => {
    const statusEvents = new Set(STATUS_CATALOG.flatMap((list) => list.statuses.map((status) => status.notify ?? "")));
    for (const event of RETIRED_NOTIFICATION_EVENTS) {
      expect(isSent(event), `${event} is still sent from src`).toBe(false);
      expect(statusEvents.has(event), `${event} is a status notification`).toBe(false);
    }
  });

  it("every legacy event that is NOT retired is still sent somewhere (so the list stays exact)", () => {
    for (const event of Object.values(NOTIFICATION_EVENTS)) {
      if (isRetiredNotificationEvent(event)) continue;
      expect(isSent(event), `${event} is no longer sent — add it to RETIRED_NOTIFICATION_EVENTS + a migration`).toBe(true);
    }
  });

  it("the migration switches off exactly the retired events (no DELETE)", () => {
    const sql = readFileSync(join("prisma", "migrations", "20261028090000_retire_legacy_templates", "migration.sql"), "utf8");
    expect(/\bDELETE\b/i.test(sql)).toBe(false);
    const listed = [...(sql.match(/IN \(([^)]*)\)/)?.[1].matchAll(/'([A-Z_]+)'/g) ?? [])].map((match) => match[1]).sort();
    expect(listed).toEqual([...RETIRED_NOTIFICATION_EVENTS].sort());
  });

  it("groups templates by service from the event code; shared legacy events are General / system", () => {
    expect(templateGroupFor("NV_COUNTRY_REQUEST_PAYMENT_PENDING")).toBe("NEW_VISA");
    expect(templateGroupFor("EXT_01")).toBe("VISA_EXTENSION");
    expect(templateGroupFor("VC_NEW")).toBe("VISA_CHANGE");
    expect(templateGroupFor("SF_01")).toBe("FLIGHT_SPECIAL_FARE");
    expect(templateGroupFor("RVT_NEW")).toBe("RETURN_TICKET");
    expect(templateGroupFor("OTB_01_NEW")).toBe("OTB");
    expect(templateGroupFor("OTB_APPROVED")).toBe("GENERAL");
    expect(templateGroupFor("LEAD_RECEIVED")).toBe("GENERAL");
    for (const row of templates as { event: string }[]) expect(templateGroupFor(row.event), row.event).not.toBe("GENERAL");
  });
});
