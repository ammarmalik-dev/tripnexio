/**
 * Liveness check for the container health check (Coolify on the VPS).
 * Deliberately doesn't touch the database: the container start command
 * already ran `prisma migrate deploy`, and a slow DB query here would make
 * a healthy server look dead. Exposes nothing beyond "ok".
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
