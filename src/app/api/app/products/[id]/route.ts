import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { lockTenant } from "@/lib/tenant-tx";
import { requireShopAccess } from "@/lib/security/shop-access";
import { parseJsonBody } from "@/lib/http";
import { productPatchSchema } from "@/lib/validation/products";

function validId(id: string) { return /^[0-9a-f-]{36}$/i.test(id); }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const url = new URL(request.url);
  const access = await requireShopAccess(request, { tenantId: url.searchParams.get("tenantId") ?? undefined, permission: "inventory:read", feature: "inventory" });
  if (!access) return NextResponse.json({ error: "You do not have access to this shop inventory." }, { status: 403 });
  try {
    const product = await db.product.findFirst({ where: { id, tenantId: access.tenantId, archivedAt: null } });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const inStock = product.trackImei ? await db.iMEIDevice.count({ where: { tenantId: access.tenantId, productId: id, status: "IN_STOCK", ...(access.branchId ? { branchId: access.branchId } : {}) } }) : 0;
    return NextResponse.json({ product, inStock });
  } catch (error) {
    console.error("Product detail failed", error);
    return NextResponse.json({ error: "Could not load this product." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const access = await requireShopAccess(request, { permission: "inventory:update", feature: "inventory" });
  if (!access) return NextResponse.json({ error: "You do not have permission to update products." }, { status: 403 });
  const body = await parseJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const input = productPatchSchema.safeParse(body.data);
  if (!input.success) return NextResponse.json({ error: "Check the product details.", fields: input.error.flatten().fieldErrors }, { status: 400 });
  if (input.data.trackImei && !access.planFeatures.includes("imei")) return NextResponse.json({ error: "IMEI tracking is not included in this shop's plan." }, { status: 403 });
  try {
    const product = await db.$transaction(async (tx) => {
      await lockTenant(tx, access.tenantId);
      const existing = await tx.product.findFirst({ where: { id, tenantId: access.tenantId, archivedAt: null } });
      if (!existing) return null;
      if (input.data.trackImei === false && existing.trackImei) {
        const devices = await tx.iMEIDevice.count({ where: { tenantId: access.tenantId, productId: id } });
        if (devices) throw new Error("IMEI_HISTORY_EXISTS");
      }
      const updated = await tx.product.updateMany({ where: { id, tenantId: access.tenantId, archivedAt: null }, data: input.data });
      if (!updated.count) return null;
      await tx.auditLog.create({ data: { tenantId: access.tenantId, userId: access.userId, action: "PRODUCT_UPDATED", entity: "Product", entityId: id } });
      return tx.product.findFirst({ where: { id, tenantId: access.tenantId } });
    });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof Error && error.message === "IMEI_HISTORY_EXISTS") return NextResponse.json({ error: "This product has IMEI history. IMEI tracking cannot be disabled." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That SKU is already in use in this shop." }, { status: 409 });
    console.error("Product update failed", error);
    return NextResponse.json({ error: "Could not update this product." }, { status: 503 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const access = await requireShopAccess(request, { permission: "inventory:delete", feature: "inventory" });
  if (!access) return NextResponse.json({ error: "You do not have permission to archive products." }, { status: 403 });
  try {
    const changed = await db.$transaction(async (tx) => {
      await lockTenant(tx, access.tenantId);
      const stock = await tx.iMEIDevice.count({ where: { tenantId: access.tenantId, productId: id, status: { in: ["IN_STOCK", "RESERVED"] } } });
      if (stock) throw new Error("PRODUCT_HAS_STOCK");
      const result = await tx.product.updateMany({ where: { id, tenantId: access.tenantId, archivedAt: null }, data: { archivedAt: new Date() } });
      if (result.count) await tx.auditLog.create({ data: { tenantId: access.tenantId, userId: access.userId, action: "PRODUCT_ARCHIVED", entity: "Product", entityId: id } });
      return result.count;
    });
    if (!changed) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_HAS_STOCK") return NextResponse.json({ error: "This product has devices in stock. Move them before archiving." }, { status: 409 });
    console.error("Product archive failed", error);
    return NextResponse.json({ error: "Could not archive this product." }, { status: 503 });
  }
}
