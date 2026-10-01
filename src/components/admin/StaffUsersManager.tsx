"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, KeyRound, Search, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { createStaffUserSchema, type CreateStaffUserValues } from "@/lib/validation/staff-user-schema";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import type { ServiceType } from "../../generated/prisma/enums";

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
  /** Step 39 — empty = unrestricted (every existing account starts this way). */
  allowedServiceTypes: ServiceType[];
  /** P24 — Country ids this staff member handles; empty = every country. */
  countriesHandled: string[];
}

interface CountryOption {
  id: string;
  code: string;
  name: string;
}

/**
 * P24 item 6 — searchable checkbox multi-select of countries (a native
 * <details> disclosure, so it stays keyboard-accessible without a popover
 * library). Ids not in `countries` (e.g. a since-deactivated country) are
 * kept in the selection and counted, never silently dropped.
 */
function CountryMultiSelect({
  idPrefix,
  countries,
  selected,
  onChange,
  disabled,
}: {
  idPrefix: string;
  countries: CountryOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const [filter, setFilter] = useState("");
  const selectedSet = new Set(selected);
  const known = new Map(countries.map((country) => [country.id, country]));
  const unknownCount = selected.filter((id) => !known.has(id)).length;
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? countries.filter((country) => country.name.toLowerCase().includes(needle) || country.code.toLowerCase().includes(needle))
    : countries;

  const knownNames = selected
    .map((id) => known.get(id)?.name)
    .filter((name): name is string => Boolean(name));
  const summary =
    selected.length === 0
      ? "All countries"
      : [
          knownNames.slice(0, 3).join(", "),
          knownNames.length > 3 ? `+${knownNames.length - 3} more` : "",
          unknownCount > 0 ? `${unknownCount} inactive` : "",
        ]
          .filter(Boolean)
          .join(" · ");

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);
  };

  return (
    <details className="rounded-lg border border-hairline bg-surface-1 text-xs">
      <summary className="cursor-pointer select-none px-2.5 py-1.5 text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2">
        {summary}
      </summary>
      <div className="flex flex-col gap-2 border-t border-hairline p-2">
        <label htmlFor={`${idPrefix}-country-filter`} className="sr-only">
          Filter countries
        </label>
        <input
          id={`${idPrefix}-country-filter`}
          type="search"
          value={filter}
          disabled={disabled}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search countries"
          className={cn(fieldControlClass, fieldBorderClass(false), "h-8 text-xs")}
        />
        <div className="max-h-44 overflow-y-auto pr-1">
          {countries.length === 0 ? (
            <p className="px-1 py-2 text-ink-tertiary">No active countries — add them under Admin → Countries.</p>
          ) : visible.length === 0 ? (
            <p className="px-1 py-2 text-ink-tertiary">No matching countries.</p>
          ) : (
            visible.map((country) => (
              <label key={country.id} className="flex items-center gap-1.5 px-1 py-0.5 text-ink-secondary">
                <input type="checkbox" checked={selectedSet.has(country.id)} disabled={disabled} onChange={() => toggle(country.id)} />
                {country.name} <span className="text-ink-tertiary">({country.code})</span>
              </label>
            ))
          )}
        </div>
        {selected.length > 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="self-start text-ink-accent underline-offset-2 hover:underline"
          >
            Clear (handle all countries)
          </button>
        ) : null}
      </div>
    </details>
  );
}

function CountriesCell({ user, countries, onSaved }: { user: StaffUser; countries: CountryOption[]; onSaved: (user: StaffUser) => void }) {
  const [selected, setSelected] = useState<string[]>(user.countriesHandled);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...user.countriesHandled].sort());

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await patchJson<StaffUser>(`/api/admin/users/${user.id}`, { countriesHandled: selected });
      toast.success(
        updated.countriesHandled.length > 0 ? `${updated.name}'s countries updated.` : `${updated.name} now handles every country.`
      );
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this staff member's countries. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <CountryMultiSelect idPrefix={`staff-${user.id}`} countries={countries} selected={selected} onChange={setSelected} disabled={saving} />
      {dirty ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleSave()} isLoading={saving}>
          Save Countries
        </Button>
      ) : null}
    </div>
  );
}

/** Compact checkbox grid reused by both the per-row editor and the New Staff form. */
function ServiceScopeChecklist({
  selected,
  onToggle,
  disabled,
}: {
  selected: ServiceType[];
  onToggle: (service: ServiceType) => void;
  disabled: boolean;
}) {
  const selectedSet = new Set(selected);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {SERVICE_TYPE_OPTIONS.map((option) => (
        <label key={option.value} className="flex items-center gap-1.5 text-xs text-ink-secondary">
          <input type="checkbox" checked={selectedSet.has(option.value)} disabled={disabled} onChange={() => onToggle(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  );
}

type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function NewStaffForm({
  roles,
  countries,
  onCreated,
}: {
  roles: RoleOption[];
  countries: CountryOption[];
  onCreated: (user: StaffUser) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStaffUserValues>({ resolver: zodResolver(createStaffUserSchema) });
  const [submitting, setSubmitting] = useState(false);
  const [allowedServiceTypes, setAllowedServiceTypes] = useState<ServiceType[]>([]);
  const [countriesHandled, setCountriesHandled] = useState<string[]>([]);

  const toggleService = (service: ServiceType) => {
    setAllowedServiceTypes((current) => (current.includes(service) ? current.filter((s) => s !== service) : [...current, service]));
  };

  const onSubmit = async (values: CreateStaffUserValues) => {
    setSubmitting(true);
    try {
      const created = await postJson<Omit<StaffUser, "createdAt">>("/api/admin/users", {
        ...values,
        allowedServiceTypes,
        countriesHandled,
      });
      toast.success(`Staff account "${created.name}" created.`);
      onCreated({ ...created, createdAt: new Date().toISOString() });
      reset();
      setAllowedServiceTypes([]);
      setCountriesHandled([]);
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
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-primary">Service Scope</span>
        <ServiceScopeChecklist selected={allowedServiceTypes} onToggle={toggleService} disabled={submitting} />
        <p className="mt-1 text-xs text-ink-tertiary">Leave every box unchecked for unrestricted access to every service.</p>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-primary">Countries Handled</span>
        <CountryMultiSelect idPrefix="new-staff" countries={countries} selected={countriesHandled} onChange={setCountriesHandled} disabled={submitting} />
        <p className="mt-1 text-xs text-ink-tertiary">
          Leave empty to handle every country. When set, auto-assign only gives this person leads for these destination countries.
        </p>
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

function ServiceScopeCell({ user, onSaved }: { user: StaffUser; onSaved: (user: StaffUser) => void }) {
  const [selected, setSelected] = useState<ServiceType[]>(user.allowedServiceTypes);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...user.allowedServiceTypes].sort());

  const toggle = (service: ServiceType) => {
    setSelected((current) => (current.includes(service) ? current.filter((s) => s !== service) : [...current, service]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await patchJson<StaffUser>(`/api/admin/users/${user.id}`, { allowedServiceTypes: selected });
      toast.success(
        updated.allowedServiceTypes.length > 0 ? `${updated.name}'s service scope updated.` : `${updated.name} is now unrestricted.`
      );
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this staff member's service scope. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ServiceScopeChecklist selected={selected} onToggle={toggle} disabled={saving} />
      {selected.length === 0 ? <span className="text-xs text-ink-tertiary">Unrestricted</span> : null}
      {dirty ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleSave()} isLoading={saving}>
          Save Scope
        </Button>
      ) : null}
    </div>
  );
}

export function StaffUsersManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        user.role.name.toLowerCase().includes(needle)
    );
  }, [users, search]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filteredUsers);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [userList, roleList, countryList] = await Promise.all([
          getJson<StaffUser[]>("/api/admin/users"),
          getJson<{ id: string; name: string }[]>("/api/admin/roles"),
          // Active countries from the Country master (Admin → Countries). The read-only /api/countries list is
          // used because /api/admin/countries needs masters.manage, which a staff.manage-only admin may lack.
          getJson<CountryOption[]>("/api/countries").catch((): CountryOption[] => []),
        ]);
        if (cancelled) return;
        setUsers(userList);
        setRoles(roleList.map((role) => ({ id: role.id, name: role.name })));
        setCountries(countryList.map((country) => ({ id: country.id, code: country.code, name: country.name })));
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

  const handlePasswordReset = async (user: StaffUser) => {
    if (!window.confirm(`Email a password reset link to ${user.name} (${user.email})? Their current password keeps working until they use the link.`)) {
      return;
    }
    setResettingId(user.id);
    try {
      const result = await postJson<{ sent: boolean; email: string }>(`/api/admin/users/${user.id}/password-reset`, {});
      toast.success(`Password reset link sent to ${result.email}.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send the reset email. Please try again.");
    } finally {
      setResettingId(null);
    }
  };

  const replaceUser = (updated: StaffUser) => setUsers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="staff-search" className="sr-only">
            Search staff by name, email or role
          </label>
          <input
            id="staff-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="Search by name, email or role…"
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
          />
        </div>
        <p className="text-xs text-ink-tertiary">
          {users.length} staff account{users.length === 1 ? "" : "s"} · {users.filter((user) => user.active).length} active
        </p>
      </div>
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={search ? <Search className="h-5 w-5" aria-hidden="true" /> : <Users className="h-5 w-5" aria-hidden="true" />}
          title={search ? "No matching staff" : "No staff accounts yet"}
          description={search ? "Try a different name, email or role." : "Create the first staff account below."}
        />
      ) : (
      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
        <table className="w-full min-w-[1140px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Service Scope</th>
              <th className="px-4 py-3">Countries</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((user) => (
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
                <td className="px-4 py-3 min-w-[220px]">
                  <ServiceScopeCell user={user} onSaved={replaceUser} />
                </td>
                <td className="px-4 py-3 min-w-[220px]">
                  <CountriesCell user={user} countries={countries} onSaved={replaceUser} />
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
                  <div className="flex flex-col items-start gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleToggleActive(user)}
                      isLoading={savingId === user.id}
                    >
                      {user.active ? "Deactivate" : "Reactivate"}
                    </Button>
                    {user.active ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handlePasswordReset(user)}
                        isLoading={resettingId === user.id}
                        aria-label={`Send password reset email to ${user.name}`}
                      >
                        <KeyRound className="h-4 w-4" aria-hidden="true" />
                        Send password reset
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <ListPagination noun="staff account" {...paginationProps} />
      <NewStaffForm roles={roles} countries={countries} onCreated={(user) => setUsers((current) => [...current, user])} />
    </div>
  );
}
