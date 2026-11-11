import { z } from "zod";

const optionalSku = z.string().trim().max(64).transform((value) => value ? value.toUpperCase() : null).optional();
const price = z.coerce.number().finite().min(0).max(999_999_999.99);

export const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sku: optionalSku,
  brand: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  costPrice: price.default(0),
  salePrice: price.default(0),
  trackImei: z.boolean().default(false),
});

export const productPatchSchema = productSchema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one product field to update.");

export function isValidImei(value: string) {
  if (!/^\d{15}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < value.length; index++) {
    let digit = Number(value[index]);
    if ((value.length - 1 - index) % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

const imeiValue = z.string().trim().refine(isValidImei, "Enter a valid 15-digit IMEI.");
export const imeiReceiptSchema = z.object({
  branchId: z.uuid(),
  devices: z.array(z.object({ imei: imeiValue, imei2: imeiValue.optional() })).min(1).max(100),
}).superRefine((data, context) => {
  const seen = new Set<string>();
  data.devices.forEach((device, index) => {
    for (const value of [device.imei, device.imei2].filter((item): item is string => Boolean(item))) {
      if (seen.has(value)) context.addIssue({ code: "custom", path: ["devices", index], message: "IMEI values in one intake must be unique." });
      seen.add(value);
    }
  });
});
