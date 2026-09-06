import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";

export async function GET() {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const staff = await db.user.findMany({
    where: { active: true },
    include: { role: true },
    orderBy: { name: "asc" },
  });

  return jsonSuccess(
    staff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role.name,
    }))
  );
}
