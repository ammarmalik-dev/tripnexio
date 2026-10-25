import { z } from "zod";
import { ServiceType, type ServiceType as ServiceTypeT } from "../../generated/prisma/enums";
import { STAFF_SERVICE_ACTION_VALUES } from "../auth/service-actions";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeT, ...ServiceTypeT[]];

/**
 * Admin handover §1 + §17 — one staff member's service-wise permissions and refund approval limit.
 * `mode: "ROLE"` = no rows (role permissions apply to every service); `mode: "CUSTOM"` = exactly the
 * listed grants (a service left out is closed). The confirmation `reason` is read separately
 * (readBodyReason) so it never reaches a Prisma write.
 */
export const staffServicePermissionsSchema = z
  .object({
    mode: z.enum(["ROLE", "CUSTOM"]),
    grants: z
      .array(
        z.object({
          serviceType: z.enum(serviceTypeValues),
          actions: z.array(z.enum(STAFF_SERVICE_ACTION_VALUES)).max(STAFF_SERVICE_ACTION_VALUES.length),
        })
      )
      .max(serviceTypeValues.length),
    /** Rupees; null = no limit. */
    refundApprovalLimit: z.number().min(0, "Enter 0 or more").max(100_000_000, "Limit is too large").nullable(),
  })
  .refine((value) => new Set(value.grants.map((grant) => grant.serviceType)).size === value.grants.length, {
    message: "Each service can appear only once.",
    path: ["grants"],
  });

export type StaffServicePermissionsValues = z.infer<typeof staffServicePermissionsSchema>;

export interface StaffServicePermissionsResponse {
  userId: string;
  /** Empty = role permissions for every service. */
  grants: { serviceType: ServiceTypeT; actions: string[] }[];
  refundApprovalLimit: number | null;
  /** True when the account holds admin.full — service rows and the limit never restrict it. */
  isFullAdmin: boolean;
}
