import { db } from "../db";

export interface AuditEntityRef {
  entityType: string;
  entityId: string;
}

export interface AuditTimelineEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  note: string | null;
  timestamp: Date;
  byUser: { name: string } | null;
}

export interface AuditTimeline {
  /** Oldest first. */
  entries: AuditTimelineEntry[];
  /** True when more than `limit` rows matched — `entries` then holds only the most recent `limit`. */
  truncated: boolean;
}

export const DEFAULT_TIMELINE_LIMIT = 300;

/** De-duplicates refs and drops blank ids so the OR clause stays small. */
export function dedupeEntityRefs(refs: AuditEntityRef[]): AuditEntityRef[] {
  const seen = new Set<string>();
  const result: AuditEntityRef[] = [];
  for (const ref of refs) {
    if (!ref.entityId) continue;
    const key = `${ref.entityType}:${ref.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}

/**
 * One flat AuditTrail query across a set of polymorphic entity refs — the
 * same "collect {entityType, entityId} pairs, then OR them" approach
 * GET /api/leads/[id] uses, capped so a long-lived record can't return an
 * unbounded list. When capped, the most recent `limit` rows are kept (the
 * newest activity matters most to staff) and returned oldest-first.
 */
export async function getAuditTimeline(refs: AuditEntityRef[], limit: number = DEFAULT_TIMELINE_LIMIT): Promise<AuditTimeline> {
  const unique = dedupeEntityRefs(refs);
  if (unique.length === 0) return { entries: [], truncated: false };

  const rows = await db.auditTrail.findMany({
    where: { OR: unique },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      note: true,
      timestamp: true,
      byUser: { select: { name: true } },
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const truncated = rows.length > limit;
  const entries = (truncated ? rows.slice(0, limit) : rows).reverse();
  return { entries, truncated };
}
