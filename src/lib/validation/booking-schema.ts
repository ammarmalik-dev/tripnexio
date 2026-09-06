import { z } from "zod";
import { BookingStatus, type BookingStatus as BookingStatusType } from "../../generated/prisma/enums";

export const createBookingSchema = z.object({
  quotationId: z.string().min(1, "Select a quotation"),
});

const bookingStatusValues = Object.values(BookingStatus) as [BookingStatusType, ...BookingStatusType[]];

export const updateBookingStatusSchema = z.object({
  status: z.enum(bookingStatusValues, { error: "Select a valid booking status" }),
  note: z.string().trim().min(1).optional(),
});

export type CreateBookingValues = z.infer<typeof createBookingSchema>;
export type UpdateBookingStatusValues = z.infer<typeof updateBookingStatusSchema>;
