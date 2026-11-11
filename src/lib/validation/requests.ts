import { z } from "zod";

const common = {
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(6).max(32),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(1).max(100),
};

export const accountRequestSchema = z.object({
  businessName: z.string().trim().min(2).max(160), ownerName: z.string().trim().min(2).max(120),
  ...common, businessType: z.string().trim().min(2).max(100),
  branchCount: z.coerce.number().int().min(1).max(500), employeeCount: z.coerce.number().int().min(1).max(10000),
  preferredPlan: z.string().trim().max(80).optional(), additionalDetails: z.string().trim().max(3000).optional(),
});

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(120), businessName: z.string().trim().min(2).max(160),
  ...common, preferredPlan: z.string().trim().max(80).optional(),
  preferredAt: z.string().optional().refine((value) => !value || !Number.isNaN(Date.parse(value))), message: z.string().trim().max(3000).optional(),
});
