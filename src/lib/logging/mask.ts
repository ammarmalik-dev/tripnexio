/** "rahul@example.com" -> "r***@example.com"; "+91 92381 84005" -> "******4005". For log lines only. */
export function maskRecipient(recipient: string): string {
  const value = recipient.trim();
  const at = value.indexOf("@");
  if (at > 0) return `${value.charAt(0)}***${value.slice(at)}`;
  const digits = value.replace(/\D/g, "");
  return digits.length > 4 ? `******${digits.slice(-4)}` : "****";
}
