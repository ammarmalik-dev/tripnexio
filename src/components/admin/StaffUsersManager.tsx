"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { createStaffUserSchema, type CreateStaffUserValues } from "@/lib/validation/staff-user-schema";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface RoleOption {
  id: string;
  name: string;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
  role: { id: string; name: string };
}

type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function NewStaffForm({ roles, onCreated }: { roles: RoleOption[]; onCreated: (user: StaffUser) => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStaffUserValues>({ resolver: zodResolver(createStaffUserSchema) });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (values: CreateStaffUserValues) => {
    setSubmitting(true);
    try {
      const created = await postJson<{ id: string; name: string; email: string; active: boolean; role: { id: string; name: string } }>(
        "/api/admin/users",
        values
      );
      toast.success(`Staff account "${created.name}" created.`);
      onCreated({ ...created, createdAt: new Date().toISOString() });
      reset();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this staff account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5"
    >
      <h2 className="text-sm font-semibold text-ink-heading">New Staff Account</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Name" {...register("name")} error={errors.name?.message} />
        <TextField label="Email" type="email" {...register("email")} error={errors.email?.message} />
        <TextField label="Password" type="password" {...register("password")} error={errors.password?.message} />
        <FormField label="Role" htmlFor="new-staff-role" error={errors.roleId?.message}>
          <select
            id="new-staff-role"
            defaultValue=""
            className={cn(fieldControlClass, fieldBorderClass(!!errors.roleId))}
            {...register("roleId")}
          >
            <option value="" disabled>
              Select a role
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" isLoading={submitting}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Staff Account
        </Button>
      </div>
    </form>
  );
}

export function StaffUsersManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [userList, roleList] = await Promise.all([
          getJson<StaffUser[]>("/api/admin/users"),
          getJson<{ id: string; name: string }[]>("/api/admin/roles"),
        ]);
        if (cancelled) return;
        setUsers(userList);
        setRoles(roleList.map((role) => ({ id: role.id, name: role.name })));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load staff accounts. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const handleRoleChange = async (userId: string, roleId: string) => {
    setSavingId(userId);
    try {
      const updated = await patchJson<StaffUser>(`/api/admin/users/${userId}`, { roleId });
      toast.success(`Role updated to ${updated.role.name}.`);
      setUsers((current) => current.map((user) => (user.id === userId ? updated : user)));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this staff member's role. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    setSavingId(user.id);
    try {
      const updated = await patchJson<StaffUser>(`/api/admin/users/${user.id}`, { active: !user.active });
      toast.success(updated.active ? `${updated.name} reactivated.` : `${updated.name} deactivated.`);
      setUsers((current) => current.map((entry) => (entry.id === user.id ? updated : entry)));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this staff member. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load staff accounts"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                <td className="px-4 py-3 font-medium text-ink-primary">{user.name}</td>
                <td className="px-4 py-3 text-ink-secondary">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role.id}
                    disabled={savingId === user.id}
                    onChange={(event) => void handleRoleChange(user.id, event.target.value)}
                    className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[160px] text-sm")}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      user.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
                    )}
                  >
                    {user.active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-tertiary">{formatDate(user.createdAt)}</td>
                <td className="px-4 py-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleToggleActive(user)}
                    isLoading={savingId === user.id}
                  >
                    {user.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NewStaffForm roles={roles} onCreated={(user) => setUsers((current) => [...current, user])} />
    </div>
  );
}
