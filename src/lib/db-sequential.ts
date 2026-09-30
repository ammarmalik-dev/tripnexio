/**
 * Runs query thunks one after another and returns their results as a tuple,
 * like Promise.all. For read-heavy screens with many small queries: it keeps
 * a single request from taking several pooled connections at once (and the
 * local `prisma dev` database drops connections under that kind of burst).
 */
export async function runSequentially<const T extends readonly (() => Promise<unknown>)[]>(
  tasks: T
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const results: unknown[] = [];
  for (const task of tasks) results.push(await task());
  return results as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
}
