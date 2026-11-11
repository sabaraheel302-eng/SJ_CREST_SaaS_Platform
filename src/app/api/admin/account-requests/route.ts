import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/security/admin";

const statuses = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "MORE_INFORMATION_REQUIRED", "ACTIVATION_PENDING", "ACTIVATED"] as const;

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const query = url.searchParams.get("q")?.trim().slice(0, 100);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const take = 25;
  const where = {
    ...(status && statuses.includes(status as (typeof statuses)[number]) ? { status: status as (typeof statuses)[number] } : {}),
    ...(query ? { OR: [{ businessName: { contains: query, mode: "insensitive" as const } }, { ownerName: { contains: query, mode: "insensitive" as const } }, { email: { contains: query, mode: "insensitive" as const } }, { requestNumber: { contains: query, mode: "insensitive" as const } }] } : {}),
  };
  try {
    const [items, total, plans] = await Promise.all([
      db.accountRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, include: { preferredPlan: { select: { name: true } }, provisionedTenant: { include: { serialNumber: { select: { value: true } }, subscriptions: { where: { status: { in: ["PENDING", "ACTIVE", "TRIAL"] } }, orderBy: { createdAt: "desc" }, take: 1, include: { plan: { select: { name: true } } } } } } } }),
      db.accountRequest.count({ where }),
      db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, features: { select: { key: true, limit: true } } } }),
    ]);
    return NextResponse.json({ items, plans, page, pageSize: take, total });
  } catch (error) {
    console.error("Account request list failed", error);
    return NextResponse.json({ error: "Could not load account requests." }, { status: 503 });
  }
}
