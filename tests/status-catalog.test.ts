import { describe, expect, it } from "vitest";
import { STATUS_CATALOG, STANDALONE_TEMPLATE_EVENTS, RETIRED_STATUS_TEMPLATE_EVENTS } from "../src/lib/service-status/catalog";
import templates from "../src/lib/service-status/template-catalog.json";
import { HOLD_MARKER, NOT_RESPONDING_MARKER, SERVICE_STATUS_SYSTEM_EVENTS } from "../src/lib/service-status/events";
import { pauseAfterHandover } from "../src/lib/service-status/engine";
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

  it("every template belongs to a status, is a known stand-alone reminder, or was retired (client doc 16 Nov)", () => {
    const used = new Set<string>([
      ...STATUS_CATALOG.flatMap((list) => list.statuses.map((status) => status.notify ?? "")),
      ...STANDALONE_TEMPLATE_EVENTS,
      ...RETIRED_STATUS_TEMPLATE_EVENTS,
    ]);
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

  it("internal-only statuses send nothing (Documents Uploaded, Ready for Submission, additional-document steps for New Visa)", () => {
    const newVisa = STATUS_CATALOG.find((list) => list.serviceType === "NEW_VISA" && list.scope === "BOOKING")!.statuses;
    for (const name of ["Documents Uploaded", "Ready for Submission", "Additional Documents Validated", "Additional Documents Submitted"]) {
      expect(newVisa.find((status) => status.name === name)?.notify, name).toBeNull();
    }
  });

  it("each list uses known system events, each event at most once, and has one On Hold status", () => {
    const allowed = new Set<string>([...SERVICE_STATUS_SYSTEM_EVENTS, HOLD_MARKER, NOT_RESPONDING_MARKER]);
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

describe("client doc 16 Nov — final status lists", () => {
  const bookingLists = STATUS_CATALOG.filter((list) => list.scope === "BOOKING");

  it("every list has the one common User Not Responding (common template) and every booking list one Booking On Hold", () => {
    for (const list of STATUS_CATALOG) {
      const unr = list.statuses.filter((status) => status.systemEvent === NOT_RESPONDING_MARKER);
      expect(unr.map((status) => [status.name, status.notify]), `${list.serviceType}/${list.scope}`).toEqual([["User Not Responding", "USER_NOT_RESPONDING"]]);
    }
    for (const list of bookingLists) {
      expect(list.statuses.find((status) => status.systemEvent === HOLD_MARKER)?.name, list.serviceType).toBe("Booking On Hold");
    }
  });

  it("Booking On Hold sits before the hand-over (Applied to Embassy / Sent to Airlines)", () => {
    for (const list of bookingLists) {
      const names = list.statuses.map((status) => status.name);
      const handover = names.findIndex((name) => /^(applied to embassy|sent to airlines)$/i.test(name));
      expect(handover, list.serviceType).toBeGreaterThan(0);
      expect(names.indexOf("Booking On Hold"), list.serviceType).toBeLessThan(handover);
    }
  });

  it("the refund steps are folded into Cancellation Requested → Partially Cancelled / Cancelled", () => {
    for (const list of bookingLists) {
      const names = list.statuses.map((status) => status.name);
      for (const gone of ["Refund Pending", "Refund Processing", "Refund Completed", "Cancelled and Refunded", "Cancellation Rejected"]) {
        expect(names, `${list.serviceType} still lists ${gone}`).not.toContain(gone);
      }
      const event = (name: string) => list.statuses.find((status) => status.name === name)?.systemEvent;
      expect(event("Cancellation Requested"), list.serviceType).toBe("REFUND_RAISED");
      expect(event("Partially Cancelled"), list.serviceType).toBe("REFUND_PARTIALLY_COMPLETED");
      expect(event("Cancelled"), list.serviceType).toBe("REFUND_COMPLETED");
    }
  });

  it("quotation services say Quotation Ready / Quotation Accepted", () => {
    for (const list of STATUS_CATALOG.filter((entry) => entry.scope === "LEAD" && ["VISA_CHANGE", "VISA_EXTENSION", "FLIGHT_SPECIAL_FARE"].includes(entry.serviceType))) {
      const byName = new Map(list.statuses.map((status) => [status.name, status]));
      expect(byName.get("Quotation Sent")?.customerLabel, list.serviceType).toBe("Quotation Ready");
      expect(byName.get("Quotation Accepted")?.customerLabel, list.serviceType).toBe("Quotation Accepted");
      expect(byName.has("Quotation Approved"), list.serviceType).toBe(false);
    }
  });

  it("the cancellation messages carry the refund ID and amount", () => {
    for (const list of bookingLists) {
      for (const name of ["Partially Cancelled", "Cancelled"]) {
        const notify = list.statuses.find((status) => status.name === name)?.notify;
        for (const channel of ["EMAIL", "WHATSAPP"]) {
          const body = rows.find((row) => row.event === notify && row.channel === channel)?.body ?? "";
          expect(body, `${notify} ${channel}`).toContain("{{refund_id}}");
        }
      }
    }
  });
});

describe("pauseAfterHandover (client doc 16 Nov, G3)", () => {
  const handover = { name: "Applied to Embassy", displayOrder: 80 };
  const hold = { name: "Booking On Hold", systemEvent: HOLD_MARKER };
  const notResponding = { name: "User Not Responding", systemEvent: NOT_RESPONDING_MARKER };

  it("allows hold / not responding before the hand-over", () => {
    expect(pauseAfterHandover(handover, { displayOrder: 50, systemEvent: "DOCUMENTS_VALIDATED" }, hold)).toBeNull();
    expect(pauseAfterHandover(handover, { displayOrder: 50, systemEvent: "DOCUMENTS_VALIDATED" }, notResponding)).toBeNull();
  });

  it("refuses them once the booking is with the embassy / airline", () => {
    expect(pauseAfterHandover(handover, { displayOrder: 80, systemEvent: "EMBASSY_APPLIED" }, hold)).toMatch(/only available before "Applied to Embassy"/);
    expect(pauseAfterHandover(handover, { displayOrder: 100, systemEvent: "EMBASSY_ADDITIONAL_DOCS" }, notResponding)).not.toBeNull();
  });

  it("never blocks other moves or a list without a hand-over", () => {
    expect(pauseAfterHandover(handover, { displayOrder: 100, systemEvent: null }, { name: "Visa Application Approved", systemEvent: "DELIVERED_VISA_PDF" })).toBeNull();
    expect(pauseAfterHandover(null, { displayOrder: 100, systemEvent: null }, hold)).toBeNull();
  });
});
