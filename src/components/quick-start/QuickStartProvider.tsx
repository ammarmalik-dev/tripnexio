"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  SAMPLE_AIRLINE_OPTIONS,
  SAMPLE_AIRPORT_OPTIONS,
  SERVICE_TABS,
  VISA_SERVICE_OPTIONS,
  type ServiceKey,
} from "@/lib/quick-start-config";

interface QuickStartFields {
  visaService: string;
  flightFrom: string;
  flightTo: string;
  flightDate: string;
  otbAirline: string;
  otbDate: string;
}

interface QuickStartContextValue extends QuickStartFields {
  service: ServiceKey;
  setService: (service: ServiceKey) => void;
  setField: <K extends keyof QuickStartFields>(key: K, value: QuickStartFields[K]) => void;
  serviceLabel: string;
  docked: boolean;
  setDocked: Dispatch<SetStateAction<boolean>>;
  overlayOpen: boolean;
  setOverlayOpen: Dispatch<SetStateAction<boolean>>;
}

const QuickStartContext = createContext<QuickStartContextValue | null>(null);

const defaultFields: QuickStartFields = {
  visaService: VISA_SERVICE_OPTIONS[0].value,
  flightFrom: SAMPLE_AIRPORT_OPTIONS[0].value,
  flightTo: SAMPLE_AIRPORT_OPTIONS[2].value,
  flightDate: "",
  otbAirline: SAMPLE_AIRLINE_OPTIONS[0].value,
  otbDate: "",
};

export function QuickStartProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<ServiceKey>("visa");
  const [fields, setFields] = useState<QuickStartFields>(defaultFields);
  const [docked, setDocked] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const setField = useCallback(
    <K extends keyof QuickStartFields>(key: K, value: QuickStartFields[K]) => {
      setFields((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const serviceLabel = useMemo(
    () => SERVICE_TABS.find((tab) => tab.key === service)?.label ?? "",
    [service]
  );

  const value = useMemo<QuickStartContextValue>(
    () => ({
      ...fields,
      service,
      setService,
      setField,
      serviceLabel,
      docked,
      setDocked,
      overlayOpen,
      setOverlayOpen,
    }),
    [fields, service, setField, serviceLabel, docked, overlayOpen]
  );

  return <QuickStartContext.Provider value={value}>{children}</QuickStartContext.Provider>;
}

export function useQuickStart() {
  const ctx = useContext(QuickStartContext);
  if (!ctx) {
    throw new Error("useQuickStart must be used within a QuickStartProvider");
  }
  return ctx;
}
