"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Mail, Phone, Plus, Search, UserRound, Users, X } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
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
  /** Client corrections 2026-10-05 — profile details from the Create Staff form. */
  mobile: string | null;
  officialId: string | null;
  personalDetails: string | null;
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

/**
 * Client corrections 2026-10-05 — the simple Create Staff form: Name, Role,
 * Official Email (login), Mobile, Official ID and Personal Details. The login
 * details are emailed automatically; service scope and countries are set
 * afterwards in the staff profile.
 */
function NewStaffForm({ roles, onCreated, onClose }: { roles: RoleOption[]; onCreated: (user: StaffUser) => void; onClose: () => void }) {
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
      const created = await postJson<StaffUser & { credentialsEmailed: boolean }>("/api/admin/users", {
        ...values,
        officialId: values.officialId || undefined,
        personalDetails: values.personalDetails || undefined,
      });
      toast.success(
        created.credentialsEmailed
          ? `Staff account created — login details emailed to ${created.email}.`
          : `Staff account created, but the login email couldn't be sent. Use "Send password reset" from the profile.`
      );
      onCreated(created);
      reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this staff account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-heading">Create Staff</h2>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Name" required {...register("name")} error={errors.name?.message} />
        <FormField label="Role" htmlFor="new-staff-role" error={errors.roleId?.message} required>
          <select id="new-staff-role" defaultValue="" className={cn(fieldControlClass, fieldBorderClass(!!errors.roleId))} {...register("roleId")}>
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
        <TextField label="Official Email (login)" type="email" required hint="Login details are sent here." {...register("email")} error={errors.email?.message} />
        <TextField label="Mobile Number" type="tel" required {...register("mobile")} error={errors.mobile?.message} />
        <TextField label="Official ID" hint="Employee / staff ID (optional)." {...register("officialId")} error={errors.officialId?.message} />
      </div>
      <Textarea label="Personal Details" rows={3} hint="Address, personal email, emergency contact… (optional)" {...register("personalDetails")} error={errors.personalDetails?.message} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" isLoading={submitting}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Staff &amp; Email Login
        </Button>
      </div>
    </form>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function StaffCard({ user, onOpen }: { user: StaffUser; onOpen: () => void }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-1 p-5 shadow-[0_6px_18px_rgb(24_42_77/0.05)]">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white",
            user.active ? "bg-[image:var(--gradient-accent)]" : "bg-ink-tertiary"
          )}
        >
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink-heading" title={user.name}>
            {user.name}
          </p>
          <p className="text-sm text-ink-secondary">{user.role.name}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", user.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
          {user.active ? "Active" : "Deactivated"}
        </span>
      </div>
      <div className="flex flex-col gap-1 text-xs text-ink-tertiary">
        <span className="inline-flex items-center gap-1.5 break-all">
          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {user.email}
        </span>
        {user.mobile ? (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {user.mobile}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-ink-secondary">
        <span className="font-medium">Service scope:</span>{" "}
        {user.allowedServiceTypes.length === 0
          ? "All services"
          : user.allowedServiceTypes.map((type) => SERVICE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type).join(", ")}
      </p>
      <Button type="button" size="sm" variant="ghost" className="mt-auto self-start" onClick={onOpen}>
        <UserRound className="h-4 w-4" aria-hidden="true" />
        View Profile
      </Button>
    </article>
  );
}

function ProfileDetailsForm({ user, onSaved }: { user: StaffUser; onSaved: (user: StaffUser) => void }) {
  const [mobile, setMobile] = useState(user.mobile ?? "");
  const [officialId, setOfficialId] = useState(user.officialId ?? "");
  const [personalDetails, setPersonalDetails] = useState(user.personalDetails ?? "");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const dirty = mobile !== (user.mobile ?? "") || officialId !== (user.officialId ?? "") || personalDetails !== (user.personalDetails ?? "");

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<StaffUser>(`/api/admin/users/${user.id}`, { mobile, officialId, personalDetails });
      toast.success("Profile details saved.");
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Mobile Number" name={`mobile-${user.id}`} value={mobile} onChange={(event) => setMobile(event.target.value)} error={errors.mobile?.[0]} disabled={saving} />
        <TextField label="Official ID" name={`official-${user.id}`} value={officialId} onChange={(event) => setOfficialId(event.target.value)} error={errors.officialId?.[0]} disabled={saving} />
      </div>
      <Textarea label="Personal Details" name={`personal-${user.id}`} rows={3} value={personalDetails} onChange={(event) => setPersonalDetails(event.target.value)} error={errors.personalDetails?.[0]} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={!dirty}>
          Save details
        </Button>
      </div>
    </div>
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
  const [createOpen, setCreateOpen] = useState(false);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        (user.mobile ?? "").includes(needle) ||
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

  const openUser = users.find((user) => user.id === openUserId) ?? null;

  if (openUser) {
    return (
      <div className="flex flex-col gap-5">
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setOpenUserId(null)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All staff
        </Button>
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-hairline bg-surface-1 p-6">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white",
              openUser.active ? "bg-[image:var(--gradient-accent)]" : "bg-ink-tertiary"
            )}
          >
            {initials(openUser.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-ink-heading">{openUser.name}</h2>
            <p className="text-sm text-ink-secondary">
              {openUser.email} · joined {formatDate(openUser.createdAt)}
            </p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-sm font-medium", openUser.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
            {openUser.active ? "Active" : "Deactivated"}
          </span>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button type="button" size="sm" variant={openUser.active ? "ghost" : "primary"} onClick={() => void handleToggleActive(openUser)} isLoading={savingId === openUser.id}>
              {openUser.active ? "Deactivate" : "Activate"}
            </Button>
            {openUser.active ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => void handlePasswordReset(openUser)} isLoading={resettingId === openUser.id}>
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Send password reset
              </Button>
            ) : null}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-1 p-6">
            <h3 className="text-sm font-semibold text-ink-heading">Role</h3>
            <select
              aria-label="Role"
              value={openUser.role.id}
              disabled={savingId === openUser.id}
              onChange={(event) => void handleRoleChange(openUser.id, event.target.value)}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-10 text-sm")}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <h3 className="mt-2 text-sm font-semibold text-ink-heading">Service Scope</h3>
            <ServiceScopeCell user={openUser} onSaved={replaceUser} />
            <h3 className="mt-2 text-sm font-semibold text-ink-heading">Countries Handled</h3>
            <CountriesCell user={openUser} countries={countries} onSaved={replaceUser} />
          </section>
          <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-1 p-6">
            <h3 className="text-sm font-semibold text-ink-heading">Profile Details</h3>
            <ProfileDetailsForm key={openUser.id} user={openUser} onSaved={replaceUser} />
          </section>
        </div>
      </div>
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
        <div className="flex items-center gap-3">
          <p className="text-xs text-ink-tertiary">
            {users.length} staff · {users.filter((user) => user.active).length} active
          </p>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Staff
          </Button>
        </div>
      </div>
      {createOpen ? (
        <NewStaffForm roles={roles} onClose={() => setCreateOpen(false)} onCreated={(user) => setUsers((current) => [...current, user])} />
      ) : null}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={search ? <Search className="h-5 w-5" aria-hidden="true" /> : <Users className="h-5 w-5" aria-hidden="true" />}
          title={search ? "No matching staff" : "No staff accounts yet"}
          description={search ? "Try a different name, email or role." : "Use Create Staff to add the first account."}
        />
      ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pageItems.map((user) => (
          <StaffCard key={user.id} user={user} onOpen={() => setOpenUserId(user.id)} />
        ))}
      </div>
      )}
      <ListPagination noun="staff account" {...paginationProps} />
    </div>
  );
}
