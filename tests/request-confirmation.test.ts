import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STATUS_CATALOG } from "../src/lib/service-status/catalog";
import templates from "../src/lib/service-status/template-catalog.json";
import { fallbackConfirmation, renderConfirmationText } from "../src/lib/leads/request-confirmation";
import { requestReceivedMessage } from "../src/lib/leads/request-received-message";
import * as botMessages from "../src/lib/whatsapp-bot/messages";

type Template = { event: string; channel: string; body: string };
const rows = templates as Template[];

const SAMPLE: Record<string, string> = {
  customer_name: "Sample Customer",
  application_id: "11026VC001",
  lead_id: "11026VC001",
  booking_id: "11026VC001",
  country_name: "United Arab Emirates",
  passenger_names: "Sample Customer",
  visa_change_method: "",
  origin: "DEL",
  destination: "DXB",
  travel_date: "20 Nov 2026",
};

describe("one request-received confirmation everywhere (client 2026-10-28)", () => {
  it("every service's first lead status sends a WhatsApp template that renders with the reference and no placeholders", () => {
    for (const list of STATUS_CATALOG.filter((entry) => entry.scope === "LEAD")) {
      const first = list.statuses[0];
      expect(first.notify, `${list.serviceType} first status notifies`).toBeTruthy();
      const template = rows.find((row) => row.event === first.notify && row.channel === "WHATSAPP");
      expect(template, `${first.notify} WHATSAPP`).toBeTruthy();
      const text = renderConfirmationText(template!.body, SAMPLE);
      expect(text, first.notify!).toContain("11026VC001");
      expect(text).not.toMatch(/\{\{|\}\}|<[^>]+>/);
    }
  });

  it("each service's 'New' email says exactly what its WhatsApp message says (migration 20261028100000)", () => {
    const sql = readFileSync("prisma/migrations/20261028100000_request_received_email_matches_whatsapp/migration.sql", "utf8");
    for (const list of STATUS_CATALOG.filter((entry) => entry.scope === "LEAD")) {
      const event = list.statuses[0].notify!;
      const email = rows.find((row) => row.event === event && row.channel === "EMAIL")!;
      const whatsapp = rows.find((row) => row.event === event && row.channel === "WHATSAPP")!;
      expect(email.body, event).toBe(whatsapp.body);
    }
    // The migration only rewrites a row that still holds the original copy, and writes the catalog's body.
    for (const match of sql.matchAll(/\$tn_new\$([\s\S]*?)\$tn_new\$[\s\S]*?"event" = '(\w+)' AND "channel" = 'EMAIL' AND "body" = \$tn_old\$/g)) {
      expect(match[1], match[2]).toBe(rows.find((row) => row.event === match[2] && row.channel === "WHATSAPP")!.body);
    }
    expect([...sql.matchAll(/\$tn_old\$/g)].length).toBe(10);
  });

  it("drops a line whose only value is blank and strips HTML", () => {
    expect(renderConfirmationText("Hi {{customer_name}},\n\nMethod: {{visa_change_method}}\nID: {{lead_id}}", SAMPLE)).toBe("Hi Sample Customer,\n\nID: 11026VC001");
    expect(renderConfirmationText("<b>Ref</b> {{lead_id}}", SAMPLE)).toBe("Ref 11026VC001");
  });

  it("falls back to the per-service text with the reference", () => {
    expect(fallbackConfirmation("OTHER", "11026OS001")).toBe(`${requestReceivedMessage("OTHER")}\n\nYour reference: 11026OS001`);
  });

  it("the website success screen and the bot reply both use the shared confirmation, not their own copy", () => {
    const confirmation = "We've received your request. Reference: 11026VC001.";
    expect(botMessages.leadCreated(confirmation).startsWith(confirmation)).toBe(true);
    expect(botMessages.leadCreatedWithPayLink(confirmation, "https://tripnexio.com/pay/x").startsWith(confirmation)).toBe(true);
    expect(botMessages.extensionUploadRequest(confirmation, null).startsWith(confirmation)).toBe(true);
    const flow = readFileSync("src/components/forms/MultiStepRequestFlow.tsx", "utf8");
    expect(flow).toContain("description={confirmationMessage ?? successDescription}");
    const createLead = readFileSync("src/lib/leads/create-lead.ts", "utf8");
    expect(createLead).toContain("confirmationMessage: await requestConfirmationMessage(");
  });
});
