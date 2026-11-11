import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, isStrongPassword, verifyPassword } from "./passwords.ts";
import { digestToken, generateSerialNumber } from "./tokens.ts";
import { activationSchema, approvalSchema, loginSchema } from "../validation/auth.ts";
import { resolveTenantGrant } from "./tenant-access.ts";
import { addCalendarMonths } from "./dates.ts";
import { imeiReceiptSchema, isValidImei, productSchema } from "../validation/products.ts";
import type { TenantGrant } from "./tenant-access.ts";

test("serial numbers use the shop identifier format and are unique across generated samples", () => {
  const values = Array.from({ length: 500 }, generateSerialNumber);
  assert.ok(values.every((value) => /^CLN-[A-HJ-NP-Z2-9]{10}$/.test(value)));
  assert.equal(new Set(values).size, values.length);
});

test("opaque activation tokens are stored by a deterministic one-way digest", () => {
  const token = "a-random-one-time-secret";
  assert.equal(digestToken(token), digestToken(token));
  assert.notEqual(digestToken(token), token);
  assert.notEqual(digestToken(token), digestToken(`${token}-other`));
});

test("password policy rejects short and non-mixed credentials", () => {
  assert.equal(isStrongPassword("short1"), false);
  assert.equal(isStrongPassword("abcdefghijkl"), false);
  assert.equal(isStrongPassword("abcdefghijkl1"), true);
  assert.equal(isStrongPassword("letters1".repeat(20)), false);
});

test("Argon2id password hash verifies only the matching credential", async () => {
  const password = "ShopOwnerPass2026";
  const hash = await hashPassword(password);
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, password), true);
  assert.equal(await verifyPassword(hash, "WrongPassword2026"), false);
});

test("auth and provisioning payloads reject malformed input", () => {
  assert.equal(loginSchema.safeParse({ email: "not-email", password: "x" }).success, false);
  assert.equal(activationSchema.safeParse({ token: "short", password: "Pass123456789", confirmPassword: "Pass123456789" }).success, false);
  assert.equal(approvalSchema.safeParse({ planId: "not-a-uuid", termMonths: 12 }).success, false);
});

test("tenant grants reject other shops, inactive tenants, expired plans, and unauthorized branches", () => {
  const grants: TenantGrant[] = [
    { tenantId: "tenant-a", tenantStatus: "ACTIVE", branchId: "branch-a", roleName: "Inventory Manager", permissions: ["inventory:read"], planFeatures: ["inventory"], planLimits: { maxProducts: 100 }, subscriptionActive: true },
    { tenantId: "tenant-b", tenantStatus: "ACTIVE", branchId: null, roleName: "Owner", permissions: [], planFeatures: ["inventory"], planLimits: { maxProducts: 500 }, subscriptionActive: true },
    { tenantId: "tenant-c", tenantStatus: "SUSPENDED", branchId: null, roleName: "Owner", permissions: [], planFeatures: ["inventory"], planLimits: {}, subscriptionActive: true },
  ];
  assert.equal(resolveTenantGrant(grants, { tenantId: "tenant-b" })?.tenantId, "tenant-b");
  assert.equal(resolveTenantGrant(grants, { tenantId: "tenant-missing" }), null);
  assert.equal(resolveTenantGrant([{ ...grants[0]!, subscriptionActive: false }]), null);
  assert.equal(resolveTenantGrant(grants, { tenantId: "tenant-a", branchId: "branch-b" }), null);
  assert.equal(resolveTenantGrant(grants, { tenantId: "tenant-a", permission: "sales:create" }), null);
  assert.equal(resolveTenantGrant(grants, { tenantId: "tenant-a", feature: "advancedReports" }), null);
});

test("subscription terms add calendar months without overflowing short months", () => {
  assert.equal(addCalendarMonths(new Date("2026-01-31T12:00:00.000Z"), 1).toISOString(), "2026-02-28T12:00:00.000Z");
  assert.equal(addCalendarMonths(new Date("2028-01-31T12:00:00.000Z"), 1).toISOString(), "2028-02-29T12:00:00.000Z");
  assert.equal(addCalendarMonths(new Date("2026-11-10T12:00:00.000Z"), 3).toISOString(), "2027-02-10T12:00:00.000Z");
});

test("product and IMEI input validation checks Luhn digits and intake-level duplicates", () => {
  assert.equal(isValidImei("490154203237518"), true);
  assert.equal(isValidImei("490154203237519"), false);
  assert.equal(productSchema.safeParse({ name: "Galaxy S24", costPrice: "250", salePrice: "300", trackImei: true }).success, true);
  assert.equal(productSchema.safeParse({ name: "x", costPrice: -1, salePrice: 5 }).success, false);
  const duplicate = imeiReceiptSchema.safeParse({ branchId: "00000000-0000-4000-8000-000000000001", devices: [{ imei: "490154203237518" }, { imei: "490154203237518" }] });
  assert.equal(duplicate.success, false);
});
