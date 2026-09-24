import type { Metadata } from "next";
import { BookingDetail } from "@/components/crm/BookingDetail";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Booking Detail | Internal Dashboard" };

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CrmBookingDetailPage({ params }: BookingDetailPageProps) {
  const { id } = await params;
  const session = await getStaffSession();
  const canApproveRefunds = hasPermission(session, "refunds.approve");
  const canApproveBankTransfer = hasPermission(session, "payments.approve");
  return <BookingDetail bookingId={id} canApproveRefunds={canApproveRefunds} canApproveBankTransfer={canApproveBankTransfer} />;
}
