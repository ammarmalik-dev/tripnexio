"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { getJson, putJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

const WEEKDAYS = [
  { value: 0, short: "Sun", long: "Sunday" },
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
] as const;

interface RosterStaff {
  id: string;
  name: string;
  role: string;
  canWorkLeads: boolean;
  allowedServiceTypes: ServiceType[];
  onLeaveToday: boolean;
}

interface RosterEntry {
  userId: string;
  serviceType: ServiceType;
  dayOfWeek: number;
}

interface RosterData {
  autoAssignLeads: boolean;
  todayDayOfWeek: number;
  staff: RosterStaff[];
  entries: RosterEntry[];
}

type FetchState = "loading" | "success" | "error";

const cellKey = (userId: string, serviceType: ServiceType, dayOfWeek: number) => `${userId}|${serviceType}|${dayOfWeek}`;

function parseKey(key: string): RosterEntry {
  const [userId, serviceType, day] = key.split("|");
  return { userId, serviceType: serviceType as ServiceType, dayOfWeek: Number(day) };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function keysForUser(keys: Set<string>, userId: string): Set<string> {
  return new Set([...keys].filter((key) => key.startsWith(`${userId}|`)));
}

function AutoAssignToggle({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      const result = await putJson<{ autoAssignLeads?: boolean }>("/api/admin/roster", { autoAssignLeads: !enabled });
      const next = result.autoAssignLeads ?? !enabled;
      onChange(next);
      toast.success(next ? "Auto-assign is on — new leads go to the rostered staff member with the lowest PAX workload." : "Auto-assign is off.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update auto-assign. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span id="auto-assign-label" className="text-sm font-semibold text-ink-heading">
          Auto-assign new leads
        </span>
        <p className="text-xs text-ink-tertiary">
          When on, every newly submitted lead is assigned to a staff member rostered for its service today (Admin timezone),
          not on approved leave, with the lowest PAX workload. If nobody is rostered, the lead stays unassigned.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="auto-assign-label"
        disabled={saving}
        onClick={() => void toggle()}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-hairline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60",
          enabled ? "bg-accent" : "bg-ink-primary/[0.12]"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
            enabled ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

function StaffRosterCard({
  member,
  selected,
  saved,
  todayDayOfWeek,
  onToggle,
  onSaved,
}: {
  member: RosterStaff;
  selected: Set<string>;
  saved: Set<string>;
  todayDayOfWeek: number;
  onToggle: (key: string) => void;
  onSaved: (userId: string, keys: Set<string>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const dirty = !sameSet(selected, saved);

  const handleSave = async () => {
    setSaving(true);
    try {
      await putJson("/api/admin/roster", { userId: member.id, entries: [...selected].map(parseKey) });
      toast.success(`Roster saved for ${member.name}.`);
      onSaved(member.id, new Set(selected));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save this roster. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const restricted = member.allowedServiceTypes.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-ink-heading">{member.name}</span>
          <span className="text-xs text-ink-tertiary">
            {member.role}
            {member.onLeaveToday ? " · On approved leave today" : ""}
            {!member.canWorkLeads ? " · No leads.edit permission — never auto-assigned" : ""}
          </span>
        </div>
        <Button type="button" size="sm" variant={dirty ? "primary" : "ghost"} disabled={!dirty} isLoading={saving} onClick={() => void handleSave()}>
          {dirty ? "Save" : "Saved"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <caption className="sr-only">Weekly roster for {member.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1.5 pr-3 text-left text-xs font-medium text-ink-tertiary">
                Service
              </th>
              {WEEKDAYS.map((day) => (
                <th
                  key={day.value}
                  scope="col"
                  className={cn(
                    "px-1 py-1.5 text-center text-xs font-medium",
                    day.value === todayDayOfWeek ? "text-ink-accent" : "text-ink-tertiary"
                  )}
                >
                  <abbr title={day.value === todayDayOfWeek ? `${day.long} (today)` : day.long} className="no-underline">
                    {day.short}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SERVICE_TYPE_OPTIONS.map((service) => {
              const outOfScope = restricted && !member.allowedServiceTypes.includes(service.value);
              return (
                <tr key={service.value} className="border-t border-hairline">
                  <th scope="row" className="py-1.5 pr-3 text-left text-xs font-normal text-ink-secondary">
                    {service.label}
                    {outOfScope ? <span className="block text-[11px] text-ink-muted">Not in this staff member&apos;s service scope</span> : null}
                  </th>
                  {WEEKDAYS.map((day) => {
                    const key = cellKey(member.id, service.value, day.value);
                    const checked = selected.has(key);
                    return (
                      <td key={day.value} className="px-1 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving || (outOfScope && !checked)}
                          onChange={() => onToggle(key)}
                          aria-label={`${member.name} — ${service.label} on ${day.long}`}
                          className="h-4 w-4 cursor-pointer accent-accent disabled:cursor-not-allowed"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * P22 item 8 — Admin → Roster. Grid of active staff × services × weekdays
 * (ADMIN.md §13 "Roster System") plus the "Auto-assign new leads" switch.
 * Each staff card saves just that person's roster (PUT with userId); "Save
 * whole grid" replaces every active staff member's roster at once.
 */
export function StaffRosterManager() {
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<RosterData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<RosterData>("/api/admin/roster");
        if (cancelled) return;
        const keys = new Set(result.entries.map((entry) => cellKey(entry.userId, entry.serviceType, entry.dayOfWeek)));
        setData(result);
        setSelected(keys);
        setSaved(new Set(keys));
        setFetchState("success");
      } catch {
        if (!cancelled) setFetchState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const anyDirty = useMemo(() => !sameSet(selected, saved), [selected, saved]);

  const toggleCell = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const markUserSaved = (userId: string, keys: Set<string>) => {
    setSaved((current) => {
      const next = new Set([...current].filter((key) => !key.startsWith(`${userId}|`)));
      for (const key of keys) next.add(key);
      return next;
    });
  };

  const saveAll = async () => {
    setSavingAll(true);
    try {
      const result = await putJson<{ added: number; removed: number }>("/api/admin/roster", { entries: [...selected].map(parseKey) });
      setSaved(new Set(selected));
      toast.success(`Roster saved — ${result.added} shift(s) added, ${result.removed} removed.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the roster. Please try again.");
    } finally {
      setSavingAll(false);
    }
  };

  if (fetchState === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading roster">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (fetchState === "error" || !data) {
    return (
      <ErrorState
        title="Couldn't load the roster"
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFetchState("loading");
              setReloadKey((key) => key + 1);
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AutoAssignToggle enabled={data.autoAssignLeads} onChange={(value) => setData({ ...data, autoAssignLeads: value })} />

      {data.staff.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          title="No active staff yet"
          description="Create staff accounts under Admin → Staff, then build their weekly roster here."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-tertiary">
              Tick the services each staff member covers on each weekday. Today is{" "}
              <span className="font-medium text-ink-secondary">{WEEKDAYS[data.todayDayOfWeek]?.long}</span> in the Admin timezone.
            </p>
            <Button type="button" onClick={() => void saveAll()} disabled={!anyDirty} isLoading={savingAll}>
              Save whole grid
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {data.staff.map((member) => (
              <StaffRosterCard
                key={member.id}
                member={member}
                selected={keysForUser(selected, member.id)}
                saved={keysForUser(saved, member.id)}
                todayDayOfWeek={data.todayDayOfWeek}
                onToggle={toggleCell}
                onSaved={markUserSaved}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
