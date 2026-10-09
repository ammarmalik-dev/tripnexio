"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Ticket } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { ApiError, postJson } from "@/lib/api/client";

interface CreatedCoupon {
  code: string;
  amount: number;
  validUntil: string;
  leadReference: string | null;
}

function buildSchema(cap: number) {
  return z.object({
    leadReference: z.string().trim().min(3, "Enter the lead reference"),
    amount: z.number({ error: "Enter the discount" }).int("Use a whole rupee amount").min(1, "Enter the discount").max(cap, `Max ₹${cap}`),
    validDays: z.number({ error: "Enter the days" }).int().min(1, "At least 1 day").max(30, "At most 30 days"),
  });
}
type FormValues = z.infer<ReturnType<typeof buildSchema>>;

/**
 * Client testing 2026-10-09 (E3) — staff create a single-use ₹ coupon for one
 * of their leads, up to the Admin-set employee cap, without Admin approval.
 */
export function CrmCreateCouponForm({ cap }: { cap: number }) {
  const [created, setCreated] = useState<CreatedCoupon | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(buildSchema(cap)), defaultValues: { leadReference: "", validDays: 7 } });
  const asNumber = { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await postJson<CreatedCoupon>("/api/crm/coupons", values);
      setCreated(result);
      reset({ leadReference: "", validDays: 7 });
      toast.success(`Coupon ${result.code} created.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create the coupon.");
    }
  });

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
          <Ticket className="h-4 w-4 text-ink-accent" aria-hidden="true" />
          Create a coupon for a lead
        </h2>
        <p className="text-xs text-ink-tertiary">
          Up to ₹{cap.toLocaleString("en-IN")} off, single use, only on that lead. No Admin approval needed. Apply the code on the lead&apos;s quotation or payment link.
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <TextField label="Lead reference" placeholder="e.g. 11026VC010" required error={errors.leadReference?.message} {...register("leadReference")} />
        <TextField label="Discount (₹)" type="number" min={1} max={cap} required error={errors.amount?.message} {...register("amount", asNumber)} />
        <TextField label="Valid for (days)" type="number" min={1} max={30} required error={errors.validDays?.message} {...register("validDays", asNumber)} />
        <Button type="submit" isLoading={isSubmitting}>
          Create Coupon
        </Button>
      </form>
      {created ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <span className="text-ink-primary">
            <span className="font-mono font-semibold">{created.code}</span> · ₹{created.amount.toLocaleString("en-IN")} off · lead {created.leadReference} · valid until{" "}
            {new Date(created.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(created.code).then(() => toast.success("Code copied."));
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy
          </Button>
        </div>
      ) : null}
    </section>
  );
}
