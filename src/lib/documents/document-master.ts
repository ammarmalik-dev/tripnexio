import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Client corrections 2026-10-05 — every document requirement points at a
 * Document Master entry. Given the chosen entry (documentTypeId) this returns
 * its id + name; given only a name (CSV import, older callers) it finds the
 * entry by name, case-insensitively, or adds it to the master so the list
 * never splits into duplicates. Null = an unknown or disabled id.
 */
export async function resolveDocumentType(
  input: { documentTypeId?: string | null; documentName?: string | null },
  client: Client = db
): Promise<{ documentTypeId: string; documentName: string } | null> {
  if (input.documentTypeId) {
    const type = await client.documentType.findFirst({ where: { id: input.documentTypeId, active: true }, select: { id: true, name: true } });
    return type ? { documentTypeId: type.id, documentName: type.name } : null;
  }
  const name = input.documentName?.trim();
  if (!name) return null;
  const existing = await client.documentType.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, name: true } });
  if (existing) return { documentTypeId: existing.id, documentName: existing.name };
  const created = await client.documentType.create({ data: { name }, select: { id: true, name: true } });
  return { documentTypeId: created.id, documentName: created.name };
}
