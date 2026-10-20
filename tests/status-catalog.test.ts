import { describe, expect, it } from "vitest";
import { STATUS_CATALOG, STANDALONE_TEMPLATE_EVENTS } from "../src/lib/service-status/catalog";
import templates from "../src/lib/service-status/template-catalog.json";
import { HOLD_MARKER, SERVICE_STATUS_SYSTEM_EVENTS } from "../src/lib/service-status/events";
import { STATUS_VARIABLE_NAMES } from "../src/lib/notifications/status-template";

type Template = { event: string; channel: string; subject: string | null; body: string; ctaLabel: string | null; ctaLink: string | null };
const rows = templates as Template[];

describe("client status lists + templates (client doc 2026-10-20)", () => {
  it("every status that notifies has both an email and a WhatsApp template", () => {
    for (const list of STATUS_CATALOG) {
      for (const status of list.statuses) {
        if (!status.notify) continue;
        expect(rows.some((row) => row.event === status.notify && row.channel === "EMAIL"), `${status.notify} EMAIL`).toBe(true);
        expect(rows.some((row) => row.event === status.notify && row.channel === "WHATSAPP"), `${status.notify} WHATSAPP`).toBe(true);
      }
    }
  });

  it("every template belongs to a status or is a known stand-alone reminder", () => {
    const used = new Set<string>([...STATUS_CATALOG.flatMap((list) => list.statuses.map((status) => status.notify ?? "")), ...STANDALONE_TEMPLATE_EVENTS]);
    for (const row of rows) expect(used.has(row.event), row.event).toBe(true);
  });

  it("templates only use variables the system fills in, and never a raw link (links are buttons)", () => {
    const known = new Set<string>(STATUS_VARIABLE_NAMES);
    for (const row of rows) {
      const text = `${row.subject ?? ""}\n${row.body}`;
      for (const match of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) expect(known.has(match[1]), `${row.event}: {{${match[1]}}}`).toBe(true);
      expect(/\{\{\s*\w*(link|url)\w*\s*\}\}/.test(text), `${row.event} has a raw link`).toBe(false);
      if (row.ctaLink) expect(known.has(row.ctaLink), `${row.event} button link ${row.ctaLink}`).toBe(true);
    }
  });

  it("internal-only statuses send nothing (Documents Uploaded, Ready for Submission, Refund Pending for New Visa…)", () => {
    const newVisa = STATUS_CATALOG.find((list) => list.serviceType === "NEW_VISA" && list.scope === "BOOKING")!.statuses;
    for (const name of ["Documents Uploaded", "Ready for Submission", "Additional Documents Validated", "Refund Pending", "Cancelled and Refunded"]) {
      expect(newVisa.find((status) => status.name === name)?.notify, name).toBeNull();
    }
  });

  it("each list uses known system events, each event at most once, and has one On Hold status", () => {
    const allowed = new Set<string>([...SERVICE_STATUS_SYSTEM_EVENTS, HOLD_MARKER]);
    for (const list of STATUS_CATALOG) {
      const events = list.statuses.map((status) => status.systemEvent).filter((event): event is string => !!event);
      for (const event of events) expect(allowed.has(event), `${list.serviceType}/${list.scope}: ${event}`).toBe(true);
      expect(new Set(events).size, `${list.serviceType}/${list.scope} duplicate event`).toBe(events.length);
      expect(list.statuses.filter((status) => status.systemEvent === HOLD_MARKER)).toHaveLength(1);
      expect(new Set(list.statuses.map((status) => status.name)).size).toBe(list.statuses.length);
    }
  });

  it("Visa Change keeps the client's order after Documents Validated: Package Generated → Exit Completed → Ready for Submission", () => {
    const names = STATUS_CATALOG.find((list) => list.serviceType === "VISA_CHANGE" && list.scope === "BOOKING")!.statuses.map((status) => status.name);
    const at = (name: string) => names.indexOf(name);
    expect(at("Documents Validated")).toBeLessThan(at("Package Generated"));
    expect(at("Package Generated")).toBeLessThan(at("Exit Completed"));
    expect(at("Exit Completed")).toBeLessThan(at("Ready for Submission"));
    expect(names).not.toContain("New Visa Processing");
  });

  it("approval emails carry the client's travel instructions and 24-hour disclaimer", () => {
    for (const event of ["NV_VISA_APPROVED", "VC_VISA_APPROVED", "VC_PACKAGE_GENERATED"]) {
      const email = rows.find((row) => row.event === event && row.channel === "EMAIL")!;
      expect(email.body).toContain("Important Travel Instructions");
      expect(email.body).toContain("Disclaimer");
    }
    expect(rows.find((row) => row.event === "RVT_TICKET_ISSUED" && row.channel === "EMAIL")!.body).toContain("within 4 hours");
    expect(rows.find((row) => row.event === "SF_15" && row.channel === "EMAIL")!.body).toContain("within 12 hours");
  });
});
