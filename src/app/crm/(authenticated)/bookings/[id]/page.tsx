import type { Metadata } from "next";
import { BookingDetail } from "@/components/crm/BookingDetail";

export const metadata: Metadata = { title: "Booking Detail | CRM" };

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CrmBookingDetailPage({ params }: BookingDetailPageProps) {
  const { id } = await params;
  return <BookingDetail bookingId={id} />;
}
