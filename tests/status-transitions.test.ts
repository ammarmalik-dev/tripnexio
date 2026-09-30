import { describe, expect, it } from "vitest";
import { assertValidBookingTransition, getAllowedNextBookingStatuses } from "@/lib/bookings/transitions";
import { assertValidLeadTransition, getAllowedNextStatuses } from "@/lib/leads/transitions";
import { assertValidRefundTransition, getAllowedNextRefundStatuses } from "@/lib/refunds/transitions";

describe("booking transitions", () => {
  it("allows the forward lifecycle and cancellation", () => {
    expect(assertValidBookingTransition("PENDING", "CONFIRMED")).toBeNull();
    expect(assertValidBookingTransition("CONFIRMED", "PROCESSING")).toBeNull();
    expect(assertValidBookingTransition("PROCESSING", "COMPLETED")).toBeNull();
    expect(assertValidBookingTransition("COMPLETED", "REFUNDED")).toBeNull();
    expect(assertValidBookingTransition("PROCESSING", "CANCELLED")).toBeNull();
  });

  it("rejects backwards jumps and moves out of terminal states", () => {
    expect(assertValidBookingTransition("CONFIRMED", "PENDING")).toBe("Can't move a booking from CONFIRMED to PENDING.");
    expect(assertValidBookingTransition("PENDING", "COMPLETED")).not.toBeNull();
    expect(assertValidBookingTransition("COMPLETED", "CANCELLED")).not.toBeNull();
    expect(getAllowedNextBookingStatuses("CANCELLED")).toEqual([]);
    expect(getAllowedNextBookingStatuses("REFUNDED")).toEqual([]);
  });

  it("same-status is a no-op success", () => {
    expect(assertValidBookingTransition("CANCELLED", "CANCELLED")).toBeNull();
  });
});

describe("lead transitions", () => {
  it("allows the funnel order", () => {
    const funnel = ["NEW", "CONTACTED", "QUALIFIED", "QUOTATION_CREATED", "QUOTATION_ACCEPTED", "PAYMENT_PENDING", "CONVERTED"] as const;
    for (let i = 0; i < funnel.length - 1; i++) {
      expect(assertValidLeadTransition(funnel[i], funnel[i + 1])).toBeNull();
    }
  });

  it("Lost / Closed / Follow-up are reachable from every non-terminal state", () => {
    for (const from of ["NEW", "CONTACTED", "QUALIFIED", "QUOTATION_CREATED", "PAYMENT_PENDING"] as const) {
      expect(getAllowedNextStatuses(from)).toEqual(expect.arrayContaining(["LOST", "CLOSED", "FOLLOW_UP_REQUIRED"]));
    }
  });

  it("rejects skipping steps and leaving terminal states", () => {
    expect(assertValidLeadTransition("NEW", "CONVERTED")).toBe("Can't move a lead from NEW to CONVERTED.");
    expect(assertValidLeadTransition("NEW", "QUOTATION_CREATED")).not.toBeNull();
    expect(assertValidLeadTransition("CONVERTED", "NEW")).not.toBeNull();
    expect(assertValidLeadTransition("LOST", "CONTACTED")).not.toBeNull();
    expect(getAllowedNextStatuses("CLOSED")).toEqual([]);
  });
});

describe("refund transitions", () => {
  it("allows PENDING -> PROCESSING -> COMPLETED and rejection before completion", () => {
    expect(assertValidRefundTransition("PENDING", "PROCESSING")).toBeNull();
    expect(assertValidRefundTransition("PROCESSING", "COMPLETED")).toBeNull();
    expect(assertValidRefundTransition("PENDING", "REJECTED")).toBeNull();
    expect(assertValidRefundTransition("PROCESSING", "REJECTED")).toBeNull();
  });

  it("rejects skipping PROCESSING and reversing terminal states", () => {
    expect(assertValidRefundTransition("PENDING", "COMPLETED")).not.toBeNull();
    expect(assertValidRefundTransition("COMPLETED", "PENDING")).toBe("Can't move a refund from COMPLETED to PENDING.");
    expect(assertValidRefundTransition("REJECTED", "PROCESSING")).not.toBeNull();
    expect(getAllowedNextRefundStatuses("COMPLETED")).toEqual([]);
  });
});
