import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sendActivationEmail } from "@/lib/email";
import { requireAdmin, unauthorized, writeAudit } from "@/lib/security/admin";
import { createOpaqueToken, digestToken, generateSerialNumber } from "@/lib/security/tokens";
import { verifySameOrigin } from "@/lib/security/session";
import { approvalSchema } from "@/lib/validation/auth";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifySameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Account request not found." }, { status: 404 });
  const body = await parseJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const input = approvalSchema.safeParse(body.data);
  if (!input.success) return NextResponse.json({ error: "Choose a valid plan and subscription duration." }, { status: 400 });
  const rawToken = createOpaqueToken();
  const now = new Date();
  let provisioned: { tenantId: string; tenantName: string; email: string; serialNumber: string };
  try {
    provisioned = await db.$transaction(async (tx) => {
      const account = await tx.accountRequest.findUnique({ where: { id } });
      if (!account || !["PENDING", "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED"].includes(account.status)) throw new Error("REQUEST_NOT_APPROVABLE");
      const existingUser = await tx.user.findUnique({ where: { email: account.email }, select: { id: true } });
      if (existingUser) throw new Error("OWNER_EMAIL_IN_USE");
      const plan = await tx.plan.findFirst({ where: { id: input.data.planId, isActive: true }, include: { features: true } });
      if (!plan) throw new Error("PLAN_NOT_AVAILABLE");
      const branchFeature = plan.features.find((feature) => feature.key === "maxBranches");
      const employeeFeature = plan.features.find((feature) => feature.key === "maxEmployees");
      const maxBranches = branchFeature?.enabled ? branchFeature.limit ?? 1 : 1;
      const maxEmployees = employeeFeature?.enabled ? employeeFeature.limit ?? 1 : 1;
      if (account.branchCount > maxBranches || account.employeeCount > maxEmployees) throw new Error("PLAN_LIMIT_TOO_LOW");
      const ownerRole = await tx.role.upsert({ where: { name: "Owner" }, update: {}, create: { name: "Owner" } });
      const passwordPlaceholder = `!pending:${createOpaqueToken(24)}`;
      const user = await tx.user.create({ data: { email: account.email, name: account.ownerName, passwordHash: passwordPlaceholder, status: "INVITED" } });
      const tenant = await tx.tenant.create({ data: {
        name: account.businessName,
        slug: `${account.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "shop"}-${createOpaqueToken(5).toLowerCase()}`,
        status: "PENDING", country: account.country, city: account.city, phone: account.phone,
      } });
      let serial: string | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateSerialNumber();
        const inserted = await tx.serialNumber.createMany({ data: { value: candidate, status: "ASSIGNED", assignedAt: now }, skipDuplicates: true });
        if (inserted.count === 1) { serial = candidate; break; }
      }
      if (!serial) throw new Error("SERIAL_ALLOCATION_FAILED");
      const serialRow = await tx.serialNumber.findUniqueOrThrow({ where: { value: serial } });
      await tx.tenant.update({ where: { id: tenant.id }, data: { serialNumberId: serialRow.id } });
      await tx.tenantUser.create({ data: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id } });
      const branchNames = Array.from({ length: account.branchCount }, (_, index) => index === 0 ? "Main branch" : `Branch ${index + 1}`);
      await tx.branch.createMany({ data: branchNames.map((name) => ({ tenantId: tenant.id, name })) });
      await tx.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: "PENDING", startsAt: now, termMonths: input.data.termMonths } });
      await tx.activationToken.create({ data: { userId: user.id, tokenHash: digestToken(rawToken), expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } });
      const transitioned = await tx.accountRequest.updateMany({ where: { id, status: { in: ["PENDING", "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED"] } }, data: { status: "ACTIVATION_PENDING", reviewedAt: now, approvedById: admin.id, provisionedTenantId: tenant.id, preferredPlanId: plan.id, internalNotes: input.data.internalNotes ?? account.internalNotes } });
      if (transitioned.count !== 1) throw new Error("REQUEST_NOT_APPROVABLE");
      await tx.auditLog.create({ data: { userId: admin.id, tenantId: tenant.id, action: "ACCOUNT_REQUEST_APPROVED", entity: "AccountRequest", entityId: id, metadata: { requestNumber: account.requestNumber, plan: plan.name, termMonths: input.data.termMonths, serialNumber: serial } } });
      return { tenantId: tenant.id, tenantName: tenant.name, email: account.email, serialNumber: serial };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errorResponse: { status: number; message: string } = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? { status: 409, message: "A CellOn user or tenant already exists for this request." }
      : message === "REQUEST_NOT_APPROVABLE" ? { status: 409, message: "This request is no longer awaiting approval." }
      : message === "OWNER_EMAIL_IN_USE" ? { status: 409, message: "This email already belongs to a CellOn user." }
      : message === "PLAN_NOT_AVAILABLE" ? { status: 400, message: "The selected plan is unavailable." }
      : message === "PLAN_LIMIT_TOO_LOW" ? { status: 400, message: "The selected plan limits are below the requested branch or employee count." }
      : { status: 500, message: "The account could not be provisioned." };
    if (errorResponse.status === 500) console.error("Account approval failed", error);
    return NextResponse.json({ error: errorResponse.message }, { status: errorResponse.status });
  }
  try {
    await sendActivationEmail(provisioned.email, provisioned.tenantName, rawToken);
  } catch (error) {
    console.error("Activation email delivery failed", { tenantId: provisioned.tenantId, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: true, serialNumber: provisioned.serialNumber, emailSent: false, message: "Approved and provisioned, but the activation email could not be sent. Configure SMTP and resend the invite." }, { status: 202 });
  }
  try { await writeAudit("ACTIVATION_EMAIL_SENT", admin.id, { tenantId: provisioned.tenantId }); }
  catch (auditError) { console.error("Activation email audit write failed", auditError); }
  return NextResponse.json({ ok: true, serialNumber: provisioned.serialNumber, emailSent: true, message: "Approved. The activation email has been sent." }, { status: 201 });
}

export const runtime = "nodejs";
