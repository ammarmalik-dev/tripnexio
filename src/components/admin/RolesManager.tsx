"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, ShieldCheck, Users, KeyRound, Copy, Undo2, Save } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import { resolvePermissionGroups, type ResolvedPermissionGroup } from "@/lib/auth/permission-groups";
import { cn } from "@/lib/cn";

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
const NEW_ROLE = "__new__";

function sameSet(a: Set<string>, b: string[]): boolean {
  return a.size === b.length && b.every((name) => a.has(name));
}

function PermissionGroupCard({
  group,
  selected,
  fullAccess,
  disabled,
  onToggle,
  onToggleGroup,
}: {
  group: ResolvedPermissionGroup;
  selected: Set<string>;
  fullAccess: boolean;
  disabled: boolean;
  onToggle: (name: string, on: boolean) => void;
  onToggleGroup: (names: string[], on: boolean) => void;
}) {
  const names = group.permissions.map((permission) => permission.name);
  const enabledCount = fullAccess ? names.length : names.filter((name) => selected.has(name)).length;
  const allOn = enabledCount === names.length;

  return (
    <section className="flex flex-col rounded-xl border border-hairline bg-surface-1" aria-labelledby={`group-${group.key}`}>
      <header className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h3 id={`group-${group.key}`} className="text-sm font-semibold text-ink-heading">
            {group.title}
          </h3>
          <p className="text-xs text-ink-tertiary">{group.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
              enabledCount === 0 ? "bg-ink-primary/[0.06] text-ink-tertiary" : "bg-accent/10 text-accent-on-light"
            )}
          >
            {enabledCount}/{names.length}
          </span>
          <Switch
            checked={allOn}
            onChange={(on) => onToggleGroup(names, on)}
            disabled={disabled || fullAccess}
            label={`${allOn ? "Turn off" : "Turn on"} all ${group.title} permissions`}
          />
        </div>
      </header>
      <ul className="divide-y divide-hairline">
        {group.permissions.map((permission) => {
          const on = fullAccess || selected.has(permission.name);
          return (
            <li key={permission.name} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-primary">{permission.label}</p>
                {permission.description ? <p className="mt-0.5 text-xs leading-relaxed text-ink-tertiary">{permission.description}</p> : null}
                <p className="mt-1 font-mono text-[11px] text-ink-muted">{permission.name}</p>
              </div>
              <Switch
                size="sm"
                className="mt-0.5"
                checked={on}
                onChange={(next) => onToggle(permission.name, next)}
                disabled={disabled || fullAccess}
                label={permission.label}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RoleEditor({
  role,
  roles,
  groups,
  totalPermissions,
  onSaved,
  onCreated,
  onDirtyChange,
}: {
  /** null = creating a new role. */
  role: RoleData | null;
  roles: RoleData[];
  groups: ResolvedPermissionGroup[];
  totalPermissions: number;
  onSaved: (role: RoleData) => void;
  onCreated: (role: RoleData) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [selected, setSelected] = useState(() => new Set(role?.permissions ?? []));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const fullAccess = selected.has(ADMIN_FULL_PERMISSION);
  const dirty = role ? name.trim() !== role.name || !sameSet(selected, role.permissions) : name.trim() !== "" || selected.size > 0;

  // Report unsaved-changes state up so the role list can block switching away.
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const update = (mutate: (next: Set<string>) => void) => {
    setSelected((current) => {
      const next = new Set(current);
      mutate(next);
      return next;
    });
  };

  const visibleGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) =>
          [permission.label, permission.name, permission.description ?? "", group.title].some((text) => text.toLowerCase().includes(term))
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [groups, query]);

  const grantedCount = fullAccess ? totalPermissions : [...selected].filter((permission) => permission !== ADMIN_FULL_PERMISSION).length;

  const discard = () => {
    setName(role?.name ?? "");
    setSelected(new Set(role?.permissions ?? []));
  };

  const copyFrom = (roleId: string) => {
    const source = roles.find((candidate) => candidate.id === roleId);
    if (source) setSelected(new Set(source.permissions));
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the role a name first.");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), permissionNames: Array.from(selected) };
      if (role) {
        const updated = await patchJson<{ id: string; name: string; permissions: string[] }>(`/api/admin/roles/${role.id}`, payload);
        toast.success(`Role "${updated.name}" saved.`);
        onSaved({ ...role, name: updated.name, permissions: updated.permissions });
      } else {
        const created = await postJson<{ id: string; name: string; permissions: string[] }>("/api/admin/roles", payload);
        toast.success(`Role "${created.name}" created.`);
        onCreated({ id: created.id, name: created.name, permissions: created.permissions, userCount: 0 });
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save this role. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <label htmlFor="role-name" className="text-sm font-medium text-ink-primary">
              Role name
            </label>
            <input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Visa Operations Executive"
              disabled={saving}
              className={cn(fieldControlClass, fieldBorderClass(false), "max-w-md")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-tertiary">
            {role ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {role.userCount} staff member{role.userCount === 1 ? "" : "s"}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              {grantedCount} of {totalPermissions} permissions
            </span>
          </div>
        </div>
        {!role && roles.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            <Copy className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
            <label htmlFor="copy-from">Start from an existing role</label>
            <select
              id="copy-from"
              defaultValue=""
              onChange={(event) => copyFrom(event.target.value)}
              className="h-9 rounded-lg border border-hairline bg-surface-1 px-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/25"
            >
              <option value="" disabled>
                Choose a role…
              </option>
              {roles.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-start justify-between gap-4 rounded-xl border p-4",
          fullAccess ? "border-warning/40 bg-warning/[0.06]" : "border-hairline bg-surface-1"
        )}
      >
        <div className="flex gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              fullAccess ? "bg-warning/15 text-warning" : "bg-accent/10 text-accent-on-light"
            )}
          >
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-heading">Full access (Administrator)</p>
            <p className="text-xs leading-relaxed text-ink-tertiary">
              Grants every permission, including ones added in future. Give this only to the business owner or a trusted admin. Only a full-access
              admin can grant it, and the last full-access admin can&apos;t be removed.
            </p>
          </div>
        </div>
        <Switch
          checked={fullAccess}
          onChange={(on) => update((next) => (on ? next.add(ADMIN_FULL_PERMISSION) : next.delete(ADMIN_FULL_PERMISSION)))}
          disabled={saving}
          label="Full access (Administrator)"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="permission-search" className="sr-only">
            Search permissions
          </label>
          <input
            id="permission-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search permissions…"
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 pl-9")}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving || fullAccess}
          onClick={() => update((next) => groups.forEach((group) => group.permissions.forEach((permission) => next.add(permission.name))))}
        >
          Turn on all
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving || fullAccess}
          onClick={() => update((next) => groups.forEach((group) => group.permissions.forEach((permission) => next.delete(permission.name))))}
        >
          Turn off all
        </Button>
      </div>

      {fullAccess ? (
        <p className="text-xs text-ink-tertiary">Every permission below is included in full access. Turn full access off to choose them one by one.</p>
      ) : null}

      {visibleGroups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline px-4 py-8 text-center text-sm text-ink-tertiary">
          No permissions match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleGroups.map((group) => (
            <PermissionGroupCard
              key={group.key}
              group={group}
              selected={selected}
              fullAccess={fullAccess}
              disabled={saving}
              onToggle={(permissionName, on) => update((next) => (on ? next.add(permissionName) : next.delete(permissionName)))}
              onToggleGroup={(names, on) => update((next) => names.forEach((permissionName) => (on ? next.add(permissionName) : next.delete(permissionName))))}
            />
          ))}
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-base/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className={cn("text-sm", dirty ? "font-medium text-warning" : "text-ink-tertiary")} aria-live="polite">
          {dirty ? "You have unsaved changes" : role ? "All changes saved" : "Name the role and pick its permissions"}
        </p>
        <div className="flex items-center gap-2">
          {role ? (
            <Button type="button" variant="ghost" size="sm" onClick={discard} disabled={!dirty || saving}>
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              Discard
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={!dirty || !name.trim()}>
            {role ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {role ? "Save changes" : "Create role"}
          </Button>
        </div>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleQuery, setRoleQuery] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const roleList = await getJson<RoleData[]>("/api/admin/roles");
        const permissionList = await getJson<PermissionOption[]>("/api/admin/permissions");
        if (cancelled) return;
        setRoles(roleList);
        setPermissions(permissionList);
        setSelectedId((current) => current ?? roleList[0]?.id ?? NEW_ROLE);
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

  const groups = useMemo(() => resolvePermissionGroups(permissions), [permissions]);
  const totalPermissions = groups.reduce((sum, group) => sum + group.permissions.length, 0);
  const filteredRoles = roles.filter((role) => role.name.toLowerCase().includes(roleQuery.trim().toLowerCase()));

  const selectRole = (id: string) => {
    if (id === selectedId) return;
    if (editorDirty) {
      toast.error("Save or discard your changes before switching roles.");
      return;
    }
    setSelectedId(id);
  };

  if (state === "loading") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-80 w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
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

  const selectedRole = roles.find((role) => role.id === selectedId) ?? null;
  const creating = selectedId === NEW_ROLE || !selectedRole;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-3 lg:sticky lg:top-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-ink-heading">
            Roles <span className="font-normal text-ink-tertiary">({roles.length})</span>
          </h2>
          <Button type="button" size="sm" variant="ghost" onClick={() => selectRole(NEW_ROLE)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New role
          </Button>
        </div>
        {roles.length > 6 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
            <label htmlFor="role-search" className="sr-only">
              Search roles
            </label>
            <input
              id="role-search"
              value={roleQuery}
              onChange={(event) => setRoleQuery(event.target.value)}
              placeholder="Search roles…"
              className={cn(fieldControlClass, fieldBorderClass(false), "h-9 pl-9")}
            />
          </div>
        ) : null}
        <ul className="flex flex-col gap-1" aria-label="Roles">
          {filteredRoles.map((role) => {
            const active = role.id === selectedId;
            const isFull = role.permissions.includes(ADMIN_FULL_PERMISSION);
            const count = isFull ? totalPermissions : role.permissions.length;
            return (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => selectRole(role.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                    active ? "border-accent/30 bg-accent/[0.07]" : "border-transparent hover:bg-ink-primary/[0.03]"
                  )}
                >
                  <span className="min-w-0">
                    <span className={cn("block truncate text-sm font-medium", active ? "text-accent-on-light" : "text-ink-primary")}>{role.name}</span>
                    <span className="block text-xs text-ink-tertiary">
                      {role.userCount} staff · {count} permission{count === 1 ? "" : "s"}
                    </span>
                  </span>
                  {isFull ? (
                    <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">Full access</span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {filteredRoles.length === 0 ? <li className="px-3 py-4 text-center text-xs text-ink-tertiary">No roles match.</li> : null}
          {creating ? (
            <li>
              <span className="flex w-full items-center gap-2 rounded-lg border border-dashed border-accent/40 bg-accent/[0.04] px-3 py-2.5 text-sm font-medium text-accent-on-light">
                <Plus className="h-4 w-4" aria-hidden="true" />
                New role (unsaved)
              </span>
            </li>
          ) : null}
        </ul>
      </aside>

      <RoleEditor
        key={creating ? NEW_ROLE : selectedRole.id}
        role={creating ? null : selectedRole}
        roles={roles}
        groups={groups}
        totalPermissions={totalPermissions}
        onDirtyChange={setEditorDirty}
        onSaved={(updated) => setRoles((current) => current.map((role) => (role.id === updated.id ? updated : role)))}
        onCreated={(created) => {
          setEditorDirty(false);
          setRoles((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
          setSelectedId(created.id);
        }}
      />
    </div>
  );
}
