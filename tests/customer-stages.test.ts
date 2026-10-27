import { describe, expect, it } from "vitest";
import { customerStages, reachedStatusIds, reachedStatusNames, type StageStatus } from "../src/lib/service-status/customer-stages";

let order = 0;
const st = (name: string, label: string, extra: Partial<StageStatus> = {}): StageStatus => ({
  id: name,
  name,
  customerLabel: label,
  displayOrder: (order += 10),
  systemEvent: null,
  isTerminal: false,
  mapsToBookingStatus: null,
  ...extra,
});

// The client's OTB booking list (shape only).
const otb = [
  st("Payment Pending", "Payment Pending"),
  st("Paid", "Payment Received", { systemEvent: "PAYMENT_SUCCESS" }),
  st("Document Pending", "Documents Required", { systemEvent: "DOCUMENTS_REQUESTED" }),
  st("Documents Uploaded", "Documents Received", { systemEvent: "DOCUMENTS_RECEIVED" }),
  st("Documents Validated", "Documents Validated", { systemEvent: "DOCUMENTS_VALIDATED" }),
  st("Sent to Airlines", "Sent to Airlines", { systemEvent: "OTB_SUBMITTED" }),
  st("Additional Documents Received", "Additional Documents Received", { systemEvent: "ADDITIONAL_DOCUMENTS_RECEIVED" }),
  st("OTB Application Approved", "OTB Approved", { systemEvent: "OTB_APPROVED", isTerminal: true, mapsToBookingStatus: "COMPLETED" }),
  st("OTB Approved for Partially Applicants", "OTB Approved for Partially Applicants", { systemEvent: "PARTIAL_APPROVED" }),
  st("OTB Application Rejected", "OTB Rejected", { systemEvent: "OTB_REJECTED", isTerminal: true, mapsToBookingStatus: "CANCELLED" }),
  st("Partially Cancelled", "Partially Cancelled", { systemEvent: "REFUND_PARTIALLY_COMPLETED" }),
  st("Refund Completed", "Refund Completed", { systemEvent: "REFUND_COMPLETED" }),
];
const labels = (stages: { label: string }[]) => stages.map((stage) => stage.label);

describe("customer Track Status steps (client doc 2026-10-27, C7)", () => {
  it("the default path shows only the main steps — no partial / rejected / refund steps", () => {
    const stages = customerStages(otb, otb[1], new Set(["Payment Pending", "Paid"]));
    expect(labels(stages)).toEqual(["Payment Pending", "Payment Received", "Documents Required", "Documents Received", "Documents Validated", "Sent to Airlines", "OTB Approved"]);
    expect(stages[1].status).toBe("current");
    expect(stages.at(-1)?.status).toBe("upcoming");
  });
  it("a partial approval shows once it happened", () => {
    const reached = new Set(["Paid", "Document Pending", "Documents Uploaded", "Documents Validated", "Sent to Airlines", "OTB Approved for Partially Applicants"]);
    const stages = customerStages(otb, otb[8], reached);
    expect(stages.find((stage) => stage.label === "OTB Approved for Partially Applicants")?.status).toBe("current");
    expect(labels(stages)).not.toContain("OTB Rejected");
  });
  it("a final status leaves nothing upcoming, and an outcome never reached is never shown as done", () => {
    const reached = new Set(["Paid", "Sent to Airlines", "OTB Application Rejected"]);
    const stages = customerStages(otb, otb[9], reached);
    expect(stages.at(-1)).toEqual({ label: "OTB Rejected", status: "current" });
    expect(labels(stages)).not.toContain("OTB Approved");
    expect(stages.every((stage) => stage.status !== "upcoming")).toBe(true);
  });
  it("a skipped main step is not shown as done, and a hold sits where it happened (11026OT099)", () => {
    const withHold = [...otb, st("Booking On Hold", "Booking On Hold", { systemEvent: "ON_HOLD" })];
    const reached = new Set(["Paid", "Booking On Hold", "Additional Documents Received"]);
    const stages = customerStages(withHold, withHold[6], reached);
    expect(stages).toEqual([
      { label: "Payment Pending", status: "done" },
      { label: "Payment Received", status: "done" },
      { label: "Booking On Hold", status: "done" },
      { label: "Additional Documents Received", status: "current" },
      { label: "OTB Approved", status: "upcoming" },
    ]);
  });
  it("reads the statuses a booking was moved to from its audit notes", () => {
    const names = reachedStatusNames([
      "Paid -> Document Pending [CONFIRMED -> CONFIRMED]: system event DOCUMENTS_REQUESTED (by Asha)",
      "Admin override: Sent to Airlines -> OTB Approved for Partially Applicants: correction (by Admin)",
      "Sent to Airlines -> OTB Application Approved (by Asha)",
      null,
    ]);
    expect([...names]).toEqual(["Document Pending", "OTB Approved for Partially Applicants", "OTB Application Approved"]);
  });
  it("reached ids keep the order the booking went through them, not the status list's order", () => {
    const withHold = [...otb, st("Booking On Hold", "Booking On Hold", { systemEvent: "ON_HOLD" })];
    const ids = reachedStatusIds(withHold, [
      "(none) -> Paid (by system)",
      "Paid -> Booking On Hold (automatic hold)",
      "Booking On Hold -> Additional Documents Received (by Asha)",
    ]);
    expect([...ids]).toEqual(["Paid", "Booking On Hold", "Additional Documents Received"]);
    const stages = customerStages(withHold, withHold[6], ids);
    expect(stages.map((stage) => stage.label).indexOf("Booking On Hold")).toBeLessThan(stages.map((stage) => stage.label).indexOf("Additional Documents Received"));
  });
});
