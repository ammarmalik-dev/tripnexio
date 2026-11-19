import { redirect } from "next/navigation";

/**
 * Client doc 16 Nov (K7) — Admin → Data Export is gone: every export it offered (customers, leads, bookings, payments)
 * is on that list's own page, with its filters. An old link lands on the Admin overview.
 */
export default function AdminDataExportPage() {
  redirect("/admin");
}
