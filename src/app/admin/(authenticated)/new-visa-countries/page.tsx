import { redirect } from "next/navigation";
import { serviceConfigHref } from "@/lib/admin/service-configuration";

/** P23 item 1 — merged into the central Service Configuration hub. */
export default function AdminNewVisaCountriesPage() {
  redirect(serviceConfigHref("countries", "NEW_VISA"));
}
