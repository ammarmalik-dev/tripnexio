import type { Metadata } from "next";
import { BookingDetail } from "@/components/crm/BookingDetail";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Booking Detail | Admin" };

interface AdminBookingDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Client corrections 2026-10-05: a booking opened from Admin stays inside
 * Admin (same detail and actions as the CRM; every action's API still checks
 * its own permission).
 */
export default async function AdminBookingDetailPage({ params }: AdminBookingDetailPageProps) {
  const { id } = await params;
  const session = await getStaffSession();
  return (
    <BookingDetail
      bookingId={id}
      basePath="/admin/bookings"
      canApproveRefunds={hasPermission(session, "refunds.approve")}
      canApproveBankTransfer={hasPermission(session, "payments.approve")}
    />
  );
}
