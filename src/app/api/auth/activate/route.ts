import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, isStrongPassword, passwordPolicyMessage } from "@/lib/security/passwords";
import { digestToken } from "@/lib/security/tokens";
import { clientAddress, consumeRateLimit, rateKey } from "@/lib/security/rate-limit";
import { verifySameOrigin } from "@/lib/security/session";
import { activationSchema } from "@/lib/validation/auth";
import { addCalendarMonths } from "@/lib/security/dates";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await parseJsonBody(request);
    if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    const input = activationSchema.safeParse(body.data);
    if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message ?? "Check the submitted details." }, { status: 400 });
    if (!isStrongPassword(input.data.password)) return NextResponse.json({ error: passwordPolicyMessage }, { status: 400 });
    const throttle = await consumeRateLimit(rateKey("activation", `${clientAddress(request)}:${input.data.token}`), 8, 900);
    if (!throttle.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const tokenHash = digestToken(input.data.token);
    const token = await db.activationToken.findUnique({ where: { tokenHash }, include: { user: { include: { memberships: { include: { tenant: true, role: true } } } } } });
    const now = new Date();
    if (!token || token.consumedAt || token.revokedAt || token.expiresAt <= now || token.user.status !== "INVITED") {
      return NextResponse.json({ error: "This activation link is invalid or has expired. Contact your administrator for a new link." }, { status: 400 });
    }
    const ownerMembership = token.user.memberships.find((membership) => membership.role.name === "Owner");
    if (!ownerMembership || ownerMembership.tenant.status !== "PENDING") return NextResponse.json({ error: "This account is not awaiting activation." }, { status: 409 });
    const passwordHash = await hashPassword(input.data.password);
    await db.$transaction(async (tx) => {
      const consumed = await tx.activationToken.updateMany({ where: { id: token.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (consumed.count !== 1) throw new Error("ACTIVATION_TOKEN_ALREADY_USED");
      await tx.user.update({ where: { id: token.userId }, data: { passwordHash, status: "ACTIVE" } });
      await tx.tenant.update({ where: { id: ownerMembership.tenantId }, data: { status: "ACTIVE" } });
      const subscription = await tx.subscription.findFirst({ where: { tenantId: ownerMembership.tenantId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
      if (!subscription) throw new Error("PENDING_SUBSCRIPTION_NOT_FOUND");
      const startsAt = now;
      const endsAt = addCalendarMonths(startsAt, subscription.termMonths);
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: "ACTIVE", startsAt, endsAt } });
      await tx.accountRequest.updateMany({ where: { provisionedTenantId: ownerMembership.tenantId }, data: { status: "ACTIVATED" } });
      await tx.auditLog.create({ data: { tenantId: ownerMembership.tenantId, userId: token.userId, action: "ACCOUNT_ACTIVATED" } });
    });
    return NextResponse.json({ ok: true, message: "Your account is active. You can now sign in." });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVATION_TOKEN_ALREADY_USED") return NextResponse.json({ error: "This activation link has already been used." }, { status: 409 });
    console.error("Account activation failed", error);
    return NextResponse.json({ error: "Account activation is temporarily unavailable." }, { status: 503 });
  }
}
