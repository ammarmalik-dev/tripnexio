import bcrypt from "bcryptjs";
import { db } from "../db";

export interface StaffAuthResult {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Validates staff credentials against the User/Role tables. Returns null on any failure — never distinguishes "no such user" from "wrong password" to the caller. */
export async function authenticateStaff(email: string, password: string): Promise<StaffAuthResult | null> {
  const user = await db.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || !user.active) return null;

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role.name };
}
