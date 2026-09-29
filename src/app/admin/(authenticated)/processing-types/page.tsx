import { redirect } from "next/navigation";
import { serviceConfigHref } from "@/lib/admin/service-configuration";

/** P23 — lives in the central Service Configuration hub. */
export default function AdminProcessingTypesPage() {
  redirect(serviceConfigHref("processing"));
}
