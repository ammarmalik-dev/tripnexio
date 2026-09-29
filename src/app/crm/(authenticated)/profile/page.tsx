import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/staff-session";
import { db } from "@/lib/db";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { ChangePasswordForm } from "@/components/crm/profile/ChangePasswordForm";
import { SecurityQuestionForm } from "@/components/crm/profile/SecurityQuestionForm";
import { SignOutButton } from "@/components/crm/profile/SignOutButton";

export const metadata: Metadata = { title: "My Profile | Internal Dashboard" };

/**
 * P22 item 5 — CRM.md §31 Profile & Security: staff profile, change
 * password, security question, logout. A personal page, not an Admin
 * configuration screen — every signed-in staff member sees only their own.
 */
export default async function CrmProfilePage() {
  const session = await getStaffSession();
  if (!session) redirect("/crm/login");

  // Only the question is read — securityAnswerHash/passwordHash never leave the server.
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { securityQuestion: true },
  });

  const services =
    session.allowedServiceTypes.length === 0 ? "All services" : session.allowedServiceTypes.map((service) => SERVICE_TYPE_LABELS[service]).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-heading">My Profile</h1>
          <p className="text-sm text-ink-tertiary">Your account details, password and security question.</p>
        </div>
        <SignOutButton />
      </div>

      <section className="rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="profile-details-heading">
        <h2 id="profile-details-heading" className="mb-3 text-sm font-semibold text-ink-heading">
          Staff profile
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-ink-tertiary">Name</dt>
            <dd className="text-sm font-medium text-ink-primary">{session.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-tertiary">Email</dt>
            <dd className="break-all text-sm font-medium text-ink-primary">{session.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-tertiary">Role</dt>
            <dd className="text-sm font-medium text-ink-primary">{session.role}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-tertiary">Allowed services</dt>
            <dd className="text-sm font-medium text-ink-primary">{services}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-tertiary">Name, email, role and service access are managed by an admin.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="change-password-heading">
          <h2 id="change-password-heading" className="mb-1 text-sm font-semibold text-ink-heading">
            Change password
          </h2>
          <p className="mb-4 text-xs text-ink-tertiary">You stay signed in here; every other device is signed out.</p>
          <ChangePasswordForm />
        </section>

        <section className="rounded-xl border border-hairline bg-surface-1 p-5" aria-labelledby="security-question-heading">
          <h2 id="security-question-heading" className="mb-4 text-sm font-semibold text-ink-heading">
            Security question
          </h2>
          <SecurityQuestionForm currentQuestion={user?.securityQuestion ?? null} />
        </section>
      </div>
    </div>
  );
}
