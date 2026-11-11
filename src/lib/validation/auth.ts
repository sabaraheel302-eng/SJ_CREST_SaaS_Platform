import { z } from "zod";

export const loginSchema = z.object({ email: z.email().trim().toLowerCase().max(254), password: z.string().min(1).max(128) });
export const activationSchema = z.object({ token: z.string().min(32).max(128), password: z.string().min(12).max(128), confirmPassword: z.string().min(12).max(128) }).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });
export const approvalSchema = z.object({ planId: z.uuid(), termMonths: z.coerce.number().int().min(1).max(36), internalNotes: z.string().trim().max(4000).optional() });
export const rejectionSchema = z.object({ reason: z.string().trim().min(3).max(2000) });
