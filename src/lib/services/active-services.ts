import { cache } from "react";
import { db } from "../db";

function queryActiveServices() {
  return db.service.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Active Service rows in display order — shared by the homepage grid and the
 * footer so a page renders them from one query (React `cache()` dedupes per
 * request), and an Admin rename/reorder/disable shows up in both. Retries
 * once: the first query on a pooled connection the server already closed
 * fails, and a shared cached rejection would otherwise take down both.
 */
export const getActiveServices = cache(async () => {
  try {
    return await queryActiveServices();
  } catch {
    return queryActiveServices();
  }
});
