import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { toWhatsAppId } from "../whatsapp/phone";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Customer dedupe by mobile (P06). `Customer.mobile` is stored however it
 * was typed ("+91 98765 43210", "9876543210", ...), so an exact match alone
 * misses the same person typing it differently. Tries the exact value
 * first (indexed), then compares digits only — keeping the country code,
 * and treating a bare 10-digit number as +91 (the same rule as
 * toWhatsAppId). Oldest matching row wins, so history stays on one record.
 */
export async function findCustomerByMobile(client: Client, mobile: string) {
  const exact = await client.customer.findUnique({ where: { mobile } });
  if (exact) return exact;

  const normalized = toWhatsAppId(mobile);
  if (!normalized) return null;
  const candidates = [normalized];
  if (normalized.length === 12 && normalized.startsWith("91")) candidates.push(normalized.slice(2));

  const rows = await client.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Customer"
    WHERE regexp_replace("mobile", '[^0-9]', '', 'g') = ANY(${candidates}::text[])
    ORDER BY "createdAt" ASC
    LIMIT 1`;
  return rows[0] ? client.customer.findUnique({ where: { id: rows[0].id } }) : null;
}
