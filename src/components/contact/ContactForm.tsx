"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { Textarea } from "@/components/forms/Textarea";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { postJson, ApiError } from "@/lib/api/client";
import { HONEYPOT_FIELD } from "@/lib/validation/honeypot";
import { contactRequestSchema, type ContactRequestValues } from "@/lib/validation/contact-schema";
import { ENQUIRY_CATEGORIES, ENQUIRY_CATEGORY_LABELS } from "@/lib/enquiries/labels";

const CATEGORY_OPTIONS = ENQUIRY_CATEGORIES.map((value) => ({ value, label: ENQUIRY_CATEGORY_LABELS[value] }));

/** The Contact page form: creates an Enquiry for the support team (CRM → Enquiries); a complaint is escalated. */
export function ContactForm() {
  const [sent, setSent] = useState<{ referenceId: string; isComplaint: boolean } | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactRequestValues>({
    resolver: zodResolver(contactRequestSchema),
    defaultValues: { category: undefined, fullName: "", mobile: "", email: "", subject: "", message: "", bookingReference: "", website: "" },
  });

  const onSubmit = async (values: ContactRequestValues) => {
    try {
      const result = await postJson<{ referenceId: string; isComplaint: boolean }>("/api/leads/contact", values);
      setSent(result);
      toast.success(result.isComplaint ? "Complaint registered — our escalation team will contact you." : "Message sent — our team will get back to you.");
      reset();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (messages?.[0]) setError(field as keyof ContactRequestValues, { message: messages[0] });
        }
      }
      toast.error(error instanceof ApiError ? error.message : "Couldn't send your message. Please try again.");
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-hairline bg-surface-1 p-6" role="status">
        <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
        <h2 className="text-base font-semibold text-ink-heading">
          {sent.isComplaint ? "Your complaint has been registered" : "Thanks — we've received your message"}
        </h2>
        <p className="text-sm text-ink-secondary">
          Your reference is <strong className="text-ink-primary">{sent.referenceId}</strong>.{" "}
          {sent.isComplaint ? "Our escalation team will contact you as soon as possible." : "Keep it handy if you contact us again."}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSent(null)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-6">
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" {...register(HONEYPOT_FIELD)} />
        </label>
      </div>
      <SelectField
        label="What is this about?"
        required
        placeholder="Choose a category"
        options={CATEGORY_OPTIONS}
        error={errors.category?.message}
        hint="Choose Complaint to raise a complaint about a service; it goes straight to our escalation team."
        {...register("category")}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Full Name" required autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
        <TextField label="Mobile Number" required type="tel" autoComplete="tel" error={errors.mobile?.message} {...register("mobile")} />
        <TextField label="Email" required type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField label="Booking ID / reference (optional)" error={errors.bookingReference?.message} {...register("bookingReference")} />
      </div>
      <TextField label="Subject" required error={errors.subject?.message} {...register("subject")} />
      <Textarea label="Message" required rows={5} error={errors.message?.message} {...register("message")} />
      <p className="text-xs text-ink-tertiary">Never share card PINs, CVVs, passwords or OTPs with TripNexio.</p>
      <div>
        <Button type="submit" isLoading={isSubmitting}>
          Send message
        </Button>
      </div>
    </form>
  );
}
