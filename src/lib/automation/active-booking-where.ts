import type { Prisma } from "@/generated/prisma/client";

/**
 * Client doc 16 Nov (H13 — log review of 11026FL112) — automations never touch a booking that is being cancelled:
 * no customer reminders and no automatic hold while a refund on it is open (Refund Pending / Processing), and none
 * on a booking already On Hold.
 */
export const NO_OPEN_REFUND_WHERE: Prisma.BookingWhereInput = {
  payments: { none: { refunds: { some: { status: { in: ["PENDING", "PROCESSING"] } } } } },
};

export const NOT_ON_HOLD_WHERE: Prisma.BookingWhereInput = {
  OR: [{ serviceStatusId: null }, { serviceStatus: { isTerminal: false, OR: [{ systemEvent: null }, { systemEvent: { not: "ON_HOLD" } }] } }],
};
