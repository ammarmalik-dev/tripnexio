import { ADMIN_FULL_PERMISSION } from "../auth/permissions";
import type { RefundStatus } from "../../generated/prisma/enums";

/**
 * Admin handover §17 — "refund configuration/approval limits". Each staff
 * member may carry a `User.refundApprovalLimit`: the largest refund (₹) they
 * may approve. null = no limit; an `admin.full` holder is never limited.
 * System refunds (Special Fare auto refunds etc.) never pass through here.
 */

/** The refund statuses that count as approving it (same set as the maker-checker rule). */
export const REFUND_APPROVAL_STATUSES: readonly RefundStatus[] = ["PROCESSING", "COMPLETED"];

export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** True when this approver may not approve a refund of `amount`. */
export function isAboveApprovalLimit(input: { limit: number | null; isAdmin: boolean; amount: number }): boolean {
  if (input.isAdmin || input.limit == null) return false;
  // Rounded to paise so a ₹1000.00 refund passes a ₹1000 limit despite float noise.
  return Math.round(input.amount * 100) > Math.round(input.limit * 100);
}

/** The 403 message when the refund is above the approver's limit, else null. */
export function refundApprovalLimitError(input: { limit: number | null; isAdmin: boolean; amount: number }): string | null {
  if (!isAboveApprovalLimit(input) || input.limit == null) return null;
  return `This refund is above your approval limit (${formatRupees(input.limit)}). An admin must approve it.`;
}

/** The parts of a staff session this check needs. */
export interface ApproverSession {
  id: string;
  permissions: string[];
}

interface UserLimitReader {
  user: { findUnique(args: { where: { id: string }; select: { refundApprovalLimit: true } }): Promise<{ refundApprovalLimit: unknown } | null> };
}

/**
 * The approver's limit (null = none) and admin flag, read fresh from the DB —
 * the staff session doesn't carry the limit.
 */
export async function loadApproverLimit(client: UserLimitReader, session: ApproverSession): Promise<{ limit: number | null; isAdmin: boolean }> {
  const isAdmin = session.permissions.includes(ADMIN_FULL_PERMISSION);
  if (isAdmin) return { limit: null, isAdmin };
  const user = await client.user.findUnique({ where: { id: session.id }, select: { refundApprovalLimit: true } });
  const raw = user?.refundApprovalLimit;
  return { limit: raw == null ? null : Number(raw), isAdmin };
}
