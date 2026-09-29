import { db } from "../db";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { computeVendorScore, getVendorScoringWeights } from "./scoring";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * P22 item 6 — CRM.md §24 "Vendors" staff view (/crm/vendors). Read-only:
 * Admin (/admin/vendors) stays the source of truth for vendor config.
 *
 * Deliberately never selects gstNumber/paymentDetails. Average vendor cost is
 * computed ONLY when `includeCost` is true (vendors.viewCost) — otherwise the
 * quotation query never runs and `averageCost` is null on every row.
 */

export const VENDOR_COST_WINDOW_DAYS = 90;

export interface StaffVendorCost {
  serviceType: ServiceType;
  label: string;
  /** Average Quotation.vendorCost for this vendor + service in the window; null when there are no quotations. */
  average: number | null;
  quotations: number;
}

export interface StaffVendorRow {
  id: string;
  name: string;
  services: { serviceType: ServiceType; label: string }[];
  processingDetails: string | null;
  availability: string | null;
  /** Overall recommendation score 1-5 (admin-configured weights) — a display aid, never an auto-selection. */
  score: number;
  factorScores: { serviceSuitability: number; processingTime: number; performance: number; reliability: number };
  averageCost: StaffVendorCost[] | null;
}

export interface StaffVendorsView {
  vendors: StaffVendorRow[];
  canViewCost: boolean;
  costWindowDays: number;
}

type ServiceFilter = ServiceType | { in: ServiceType[] } | undefined;

export async function getStaffVendorsView(input: { serviceFilter: ServiceFilter; includeCost: boolean }): Promise<StaffVendorsView> {
  const { serviceFilter, includeCost } = input;
  const serviceWhere = serviceFilter ? { service: serviceFilter } : {};

  const vendors = await db.vendor.findMany({
    where: { active: true, ...(serviceFilter ? { services: { some: serviceWhere } } : {}) },
    select: {
      id: true,
      name: true,
      processingDetails: true,
      availability: true,
      serviceSuitabilityScore: true,
      processingTimeScore: true,
      performanceScore: true,
      reliabilityScore: true,
      // Only in-scope/filtered services are listed, so a scoped staff member never sees out-of-scope service tags.
      services: { where: serviceWhere, select: { service: true }, orderBy: { service: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const weights = await getVendorScoringWeights();

  // vendorId -> serviceType -> cost figures (vendors.viewCost only).
  const costByVendor = new Map<string, Map<ServiceType, { average: number | null; quotations: number }>>();
  if (includeCost && vendors.length > 0) {
    const since = new Date(Date.now() - VENDOR_COST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const vendorIds = vendors.map((v) => v.id);
    const services = [...new Set(vendors.flatMap((v) => v.services.map((s) => s.service)))];
    // One small groupBy per service (sequential) — Quotation has no serviceType
    // column of its own (it's on the lead), and groupBy can't group by a relation field.
    for (const serviceType of services) {
      const groups = await db.quotation.groupBy({
        by: ["vendorId"],
        where: { vendorId: { in: vendorIds }, createdAt: { gte: since }, lead: { serviceType } },
        _avg: { vendorCost: true },
        _count: { _all: true },
      });
      for (const g of groups) {
        const perService = costByVendor.get(g.vendorId) ?? new Map<ServiceType, { average: number | null; quotations: number }>();
        const avg = g._avg.vendorCost;
        perService.set(serviceType, { average: avg ? Math.round(Number(avg.toString()) * 100) / 100 : null, quotations: g._count._all });
        costByVendor.set(g.vendorId, perService);
      }
    }
  }

  const rows: StaffVendorRow[] = vendors
    .map((vendor) => {
      const perService = costByVendor.get(vendor.id);
      return {
        id: vendor.id,
        name: vendor.name,
        services: vendor.services.map((s) => ({ serviceType: s.service, label: SERVICE_TYPE_LABELS[s.service] })),
        processingDetails: vendor.processingDetails,
        availability: vendor.availability,
        score: computeVendorScore(vendor, weights),
        factorScores: {
          serviceSuitability: vendor.serviceSuitabilityScore,
          processingTime: vendor.processingTimeScore,
          performance: vendor.performanceScore,
          reliability: vendor.reliabilityScore,
        },
        averageCost: includeCost
          ? vendor.services.map((s) => {
              const cost = perService?.get(s.service);
              return { serviceType: s.service, label: SERVICE_TYPE_LABELS[s.service], average: cost?.average ?? null, quotations: cost?.quotations ?? 0 };
            })
          : null,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return { vendors: rows, canViewCost: includeCost, costWindowDays: VENDOR_COST_WINDOW_DAYS };
}
