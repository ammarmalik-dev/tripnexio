import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { enquiryListQuerySchema } from "@/lib/enquiries/schemas";
import { runSequentially } from "@/lib/db-sequential";
import type { Prisma } from "@/generated/prisma/client";

/** CRM → Enquiries / Complaints list. Counts of open enquiries and open complaints go with every page for the tabs. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const parsed = enquiryListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  const { category, status, view, search, page, pageSize } = parsed.data;

  const and: Prisma.EnquiryWhereInput[] = [];
  if (view === "complaints") and.push({ category: "COMPLAINT" });
  if (view === "enquiries") and.push({ category: { not: "COMPLAINT" } });
  if (category) and.push({ category });
  if (status === "open") and.push({ status: { in: ["NEW", "IN_PROGRESS"] } });
  else if (status) and.push({ status });
  if (search) {
    const contains = { contains: search, mode: "insensitive" as const };
    and.push({ OR: [{ reference: contains }, { fullName: contains }, { mobile: contains }, { email: contains }, { subject: contains }] });
  }
  const where: Prisma.EnquiryWhereInput = and.length > 0 ? { AND: and } : {};

  try {
    const [total, items, openEnquiries, openComplaints] = await runSequentially([
      () => db.enquiry.count({ where }),
      () =>
        db.enquiry.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            reference: true,
            category: true,
            status: true,
            fullName: true,
            mobile: true,
            email: true,
            subject: true,
            createdAt: true,
            escalatedAt: true,
            assignedStaff: { select: { id: true, name: true } },
          },
        }),
      () => db.enquiry.count({ where: { category: { not: "COMPLAINT" }, status: { in: ["NEW", "IN_PROGRESS"] } } }),
      () => db.enquiry.count({ where: { category: "COMPLAINT", status: { in: ["NEW", "IN_PROGRESS"] } } }),
    ] as const);
    return jsonSuccess({ items, total, page, pageSize, counts: { openEnquiries, openComplaints } });
  } catch (error) {
    console.error("[api/enquiries] list failed", error);
    return jsonError(500, "Couldn't load enquiries. Please try again.");
  }
}
