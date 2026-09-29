import { cache } from "react";
import { db } from "../db";

function queryActiveServices() {
  return db.service.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

const RETRY_DELAYS_MS = [150, 600];

/**
 * Active Service rows in display order — shared by the homepage grid and the
 * footer so a page renders them from one query (React `cache()` dedupes per
 * request), and an Admin rename/reorder/disable shows up in both. Retries a
 * couple of times with a short pause: the first query on a pooled
 * connection the server already closed fails, and a shared cached rejection
 * would otherwise take down both (seen during static generation, when many
 * pages query at once).
 */
export const getActiveServices = cache(async () => {
  for (const delay of RETRY_DELAYS_MS) {
    try {
      return await queryActiveServices();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return queryActiveServices();
});
