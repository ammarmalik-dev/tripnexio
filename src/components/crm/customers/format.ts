/** Shared display formatters for the CRM Customers screens (same en-IN style as the other CRM tables). */

export function formatCrmDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatCrmDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(value: string): string {
  return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
