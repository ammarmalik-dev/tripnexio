import { redirect } from "next/navigation";

/** Client doc 2026-10-15 (J10) — these rates live in the Pricing Dashboard. */
export default function AdminOtbPricesPage() {
  redirect("/admin/pricing-dashboard?view=otb");
}
