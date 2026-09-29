"use client";

import { useEffect, useState } from "react";
import type { ServiceType } from "../../generated/prisma/enums";
import { defaultProcessingTypes, type ProcessingTypeView } from "./defaults";

export type ProcessingTypesState = "loading" | "success" | "error";

interface ProcessingTypesResult {
  state: ProcessingTypesState;
  /** Active options in Admin order; the fallback pair on a failed fetch; empty while loading. */
  options: ProcessingTypeView[];
}

interface LoadedEntry {
  key: string;
  state: Exclude<ProcessingTypesState, "loading">;
  options: ProcessingTypeView[];
}

/**
 * P23 — processing-type options for a service from the public
 * `GET /api/processing-types?service=` endpoint (Admin master). Pass
 * `undefined` to skip fetching (e.g. before the lead has loaded).
 */
export function useProcessingTypes(serviceType: ServiceType | undefined): ProcessingTypesResult {
  const [loaded, setLoaded] = useState<LoadedEntry | null>(null);

  useEffect(() => {
    if (!serviceType) return;
    const service = serviceType;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/processing-types?service=${encodeURIComponent(service)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: ProcessingTypeView[] };
        if (!cancelled) setLoaded({ key: service, state: "success", options: json.data });
      } catch {
        if (!cancelled) setLoaded({ key: service, state: "error", options: defaultProcessingTypes(service) });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [serviceType]);

  if (!serviceType || !loaded || loaded.key !== serviceType) return { state: "loading", options: [] };
  return { state: loaded.state, options: loaded.options };
}
