import { redirect } from "next/navigation";
import { serviceConfigHref } from "@/lib/admin/service-configuration";

/** P23 — lives in the central Service Configuration hub. */
export default function AdminSubServicesPage() {
  redirect(serviceConfigHref("sub-services"));
}
