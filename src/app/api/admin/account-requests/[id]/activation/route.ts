import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendActivationEmail } from "@/lib/email";
import { requireAdmin, unauthorized, writeAudit } from "@/lib/security/admin";
import { createOpaqueToken, digestToken } from "@/lib/security/tokens";
import { verifySameOrigin } from "@/lib/security/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifySameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await context.params;
  const rawToken = createOpaqueToken();
  try {
    const record = await db.$transaction(async (tx) => {
      const account = await tx.accountRequest.findUnique({ where: { id }, include: { provisionedTenant: true } });
      if (account?.status !== "ACTIVATION_PENDING" || !account.provisionedTenant) throw new Error("ACTIVATION_NOT_PENDING");
      const owner = await tx.tenantUser.findFirst({ where: { tenantId: account.provisionedTenant.id, role: { name: "Owner" } }, include: { user: true } });
      if (!owner || owner.user.status !== "INVITED") throw new Error("INVITED_OWNER_NOT_FOUND");
      const now = new Date();
      await tx.activationToken.updateMany({ where: { userId: owner.userId, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
      await tx.activationToken.create({ data: { userId: owner.userId, tokenHash: digestToken(rawToken), expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } });
      return { email: owner.user.email, name: owner.user.name, businessName: account.provisionedTenant.name, tenantId: account.provisionedTenant.id };
    });
    await sendActivationEmail(record.email, record.businessName, rawToken);
    await writeAudit("ACTIVATION_EMAIL_RESENT", admin.id, { tenantId: record.tenantId });
    return NextResponse.json({ ok: true, message: "A new activation link has been sent." });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVATION_NOT_PENDING") return NextResponse.json({ error: "This account is not awaiting activation." }, { status: 409 });
    if (error instanceof Error && error.message === "INVITED_OWNER_NOT_FOUND") return NextResponse.json({ error: "The invited owner account was not found." }, { status: 409 });
    console.error("Activation resend failed", error);
    return NextResponse.json({ error: "Could not send a new activation link. Check SMTP configuration." }, { status: 503 });
  }
}
