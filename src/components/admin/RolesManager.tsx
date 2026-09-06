"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface PermissionOption {
  id: string;
  name: string;
  description: string | null;
}

interface RoleData {
  id: string;
  name: string;
  userCount: number;
  permissions: string[];
}

type FetchState = "loading" | "success" | "error";

function PermissionChecklist({
  permissions,
  selected,
  onToggle,
  disabled,
}: {
  permissions: PermissionOption[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {permissions.map((permission) => (
        <label key={permission.id} className="flex items-start gap-2 text-sm text-ink-secondary">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={selected.has(permission.name)}
            disabled={disabled}
            onChange={() => onToggle(permission.name)}
          />
          <span>
            <span className="font-medium text-ink-primary">{permission.name}</span>
            {permission.description ? <span className="text-ink-tertiary"> — {permission.description}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

function RoleCard({
  role,
  permissions,
  onSaved,
}: {
  role: RoleData;
  permissions: PermissionOption[];
  onSaved: (role: RoleData) => void;
}) {
  const [name, setName] = useState(role.name);
  const [selected, setSelected] = useState(new Set(role.permissions));
  const [saving, setSaving] = useState(false);

  const toggle = (permissionName: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permissionName)) next.delete(permissionName);
      else next.add(permissionName);
      return next;
    });
  };

  const dirty = name !== role.name || selected.size !== role.permissions.length || role.permissions.some((p) => !selected.has(p));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await patchJson<{ id: string; name: string; permissions: string[] }>(`/api/admin/roles/${role.id}`, {
        name,
        permissionNames: Array.from(selected),
      });
      toast.success(`Role "${updated.name}" updated.`);
      onSaved({ ...role, name: updated.name, permissions: updated.permissions });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this role. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TextField
          label="Role Name"
          name={`role-name-${role.id}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="max-w-xs"
        />
        <span className="text-xs text-ink-tertiary">
          {role.userCount} staff member{role.userCount === 1 ? "" : "s"}
        </span>
      </div>
      <PermissionChecklist permissions={permissions} selected={selected} onToggle={toggle} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewRoleForm({ permissions, onCreated }: { permissions: PermissionOption[]; onCreated: (role: RoleData) => void }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(new Set<string>());
  const [creating, setCreating] = useState(false);

  const toggle = (permissionName: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permissionName)) next.delete(permissionName);
      else next.add(permissionName);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await postJson<{ id: string; name: string; permissions: string[] }>("/api/admin/roles", {
        name: name.trim(),
        permissionNames: Array.from(selected),
      });
      toast.success(`Role "${created.name}" created.`);
      onCreated({ id: created.id, name: created.name, permissions: created.permissions, userCount: 0 });
      setName("");
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this role. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Role</h2>
      <TextField
        label="Role Name"
        name="new-role-name"
        placeholder="e.g. Read-Only Staff"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="max-w-xs"
      />
      <PermissionChecklist permissions={permissions} selected={selected} onToggle={toggle} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!name.trim()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Role
        </Button>
      </div>
    </div>
  );
}

export function RolesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [roleList, permissionList] = await Promise.all([
          getJson<RoleData[]>("/api/admin/roles"),
          getJson<PermissionOption[]>("/api/admin/permissions"),
        ]);
        if (cancelled) return;
        setRoles(roleList);
        setPermissions(permissionList);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load roles. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load roles"
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
      {roles.map((role) => (
        <RoleCard
          key={role.id}
          role={role}
          permissions={permissions}
          onSaved={(updated) => setRoles((current) => current.map((r) => (r.id === updated.id ? updated : r)))}
        />
      ))}
      <NewRoleForm permissions={permissions} onCreated={(created) => setRoles((current) => [...current, created])} />
    </div>
  );
}
