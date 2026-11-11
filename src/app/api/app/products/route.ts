import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { lockTenant } from "@/lib/tenant-tx";
import { requireShopAccess } from "@/lib/security/shop-access";
import { consumeRateLimit, rateKey } from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/http";
import { productSchema } from "@/lib/validation/products";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await requireShopAccess(request, { tenantId: url.searchParams.get("tenantId") ?? undefined, permission: "inventory:read", feature: "inventory" });
  if (!access) return NextResponse.json({ error: "You do not have access to this shop inventory." }, { status: 403 });
  const query = url.searchParams.get("q")?.trim().slice(0, 100);
  try {
    const products = await db.product.findMany({ where: { tenantId: access.tenantId, archivedAt: null, ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }, { brand: { contains: query, mode: "insensitive" } }] } : {}) }, orderBy: { name: "asc" }, take: 100, include: { _count: { select: { imeis: { where: { status: "IN_STOCK", ...(access.branchId ? { branchId: access.branchId } : {}) } } } } } });
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Product list failed", error);
    return NextResponse.json({ error: "Could not load products." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = await requireShopAccess(request, { permission: "inventory:create", feature: "inventory" });
  if (!access) return NextResponse.json({ error: "You do not have permission to add products." }, { status: 403 });
  const body = await parseJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const input = productSchema.safeParse(body.data);
  if (!input.success) return NextResponse.json({ error: "Check the product details.", fields: input.error.flatten().fieldErrors }, { status: 400 });
  if (input.data.trackImei && !access.planFeatures.includes("imei")) return NextResponse.json({ error: "IMEI tracking is not included in this shop's plan." }, { status: 403 });
  const limit = await consumeRateLimit(rateKey("product-create", access.userId), 100, 3600);
  if (!limit.allowed) return NextResponse.json({ error: "Too many products were added recently. Try again later." }, { status: 429 });
  try {
    const created = await db.$transaction(async (tx) => {
      await lockTenant(tx, access.tenantId);
      const total = await tx.product.count({ where: { tenantId: access.tenantId, archivedAt: null } });
      if (access.planLimits.maxProducts !== undefined && total >= access.planLimits.maxProducts) throw new Error("PRODUCT_LIMIT_REACHED");
      const product = await tx.product.create({ data: { ...input.data, tenantId: access.tenantId } });
      await tx.auditLog.create({ data: { tenantId: access.tenantId, userId: access.userId, action: "PRODUCT_CREATED", entity: "Product", entityId: product.id } });
      return product;
    });
    return NextResponse.json({ product: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_LIMIT_REACHED") return NextResponse.json({ error: "Your plan has reached its product limit." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That SKU is already in use in this shop." }, { status: 409 });
    console.error("Product creation failed", error);
    return NextResponse.json({ error: "Could not create the product." }, { status: 503 });
  }
}
