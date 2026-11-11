import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { lockTenant } from "@/lib/tenant-tx";
import { requireShopAccess } from "@/lib/security/shop-access";
import { parseJsonBody } from "@/lib/http";
import { imeiReceiptSchema } from "@/lib/validation/products";

function validId(id: string) { return /^[0-9a-f-]{36}$/i.test(id); }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const url = new URL(request.url);
  const access = await requireShopAccess(request, { tenantId: url.searchParams.get("tenantId") ?? undefined, permission: "inventory:read", feature: "imei" });
  if (!access) return NextResponse.json({ error: "You do not have access to these IMEI records." }, { status: 403 });
  try {
    const product = await db.product.findFirst({ where: { id, tenantId: access.tenantId, archivedAt: null, trackImei: true }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "IMEI-tracked product not found." }, { status: 404 });
    const devices = await db.iMEIDevice.findMany({ where: { tenantId: access.tenantId, productId: id, ...(access.branchId ? { branchId: access.branchId } : {}) }, orderBy: { createdAt: "desc" }, take: 250, include: { branch: { select: { name: true } } } });
    return NextResponse.json({ devices });
  } catch (error) {
    console.error("IMEI list failed", error);
    return NextResponse.json({ error: "Could not load device records." }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const body = await parseJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const input = imeiReceiptSchema.safeParse(body.data);
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message ?? "Check the IMEI values." }, { status: 400 });
  const access = await requireShopAccess(request, { branchId: input.data.branchId, permission: "inventory:receive", feature: "imei" });
  if (!access) return NextResponse.json({ error: "You do not have access to receive IMEI devices in this branch." }, { status: 403 });
  try {
    const received = await db.$transaction(async (tx) => {
      await lockTenant(tx, access.tenantId);
      const product = await tx.product.findFirst({ where: { id, tenantId: access.tenantId, archivedAt: null, trackImei: true } });
      if (!product) throw new Error("IMEI_PRODUCT_NOT_FOUND");
      const branch = await tx.branch.findFirst({ where: { id: input.data.branchId, tenantId: access.tenantId, isActive: true } });
      if (!branch) throw new Error("BRANCH_NOT_FOUND");
      const currentCount = await tx.iMEIDevice.count({ where: { tenantId: access.tenantId, status: { in: ["IN_STOCK", "RESERVED"] } } });
      if (access.planLimits.maxImeiDevices !== undefined && currentCount + input.data.devices.length > access.planLimits.maxImeiDevices) throw new Error("IMEI_LIMIT_REACHED");
      await tx.iMEIDevice.createMany({ data: input.data.devices.map((device) => ({ tenantId: access.tenantId, branchId: branch.id, productId: product.id, imei: device.imei, imei2: device.imei2, status: "IN_STOCK", costPrice: product.costPrice, salePrice: product.salePrice })) });
      const saved = await tx.iMEIDevice.findMany({ where: { tenantId: access.tenantId, productId: product.id, imei: { in: input.data.devices.map((device) => device.imei) } }, select: { id: true, imei: true, imei2: true } });
      await tx.iMEIIdentifier.createMany({ data: saved.flatMap((device) => [{ tenantId: access.tenantId, deviceId: device.id, value: device.imei, kind: "IMEI" }, ...(device.imei2 ? [{ tenantId: access.tenantId, deviceId: device.id, value: device.imei2, kind: "IMEI2" }] : [])]) });
      await tx.stockMovement.create({ data: { tenantId: access.tenantId, branchId: branch.id, productId: product.id, quantity: saved.length, kind: "IMEI_RECEIPT", reference: `imei:${product.id}` } });
      await tx.auditLog.create({ data: { tenantId: access.tenantId, userId: access.userId, action: "IMEI_STOCK_RECEIVED", entity: "Product", entityId: product.id, metadata: { branchId: branch.id, quantity: saved.length } } });
      return { count: saved.length };
    }, { maxWait: 10000, timeout: 30000 });
    return NextResponse.json({ ok: true, received: received.count }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "IMEI_PRODUCT_NOT_FOUND") return NextResponse.json({ error: "IMEI-tracked product not found." }, { status: 404 });
    if (error instanceof Error && error.message === "BRANCH_NOT_FOUND") return NextResponse.json({ error: "Choose an active branch in your shop." }, { status: 400 });
    if (error instanceof Error && error.message === "IMEI_LIMIT_REACHED") return NextResponse.json({ error: "Your plan has reached its device limit." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "One or more IMEI numbers already exist." }, { status: 409 });
    console.error("IMEI receipt failed", error);
    return NextResponse.json({ error: "Could not receive these devices." }, { status: 503 });
  }
}
