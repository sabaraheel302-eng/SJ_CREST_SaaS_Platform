import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueSession, attachSessionCookie, verifySameOrigin } from "@/lib/security/session";
import { clientAddress, consumeRateLimit, rateKey } from "@/lib/security/rate-limit";
import { verifyPasswordForLogin } from "@/lib/security/passwords";
import { loginSchema } from "@/lib/validation/auth";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await parseJsonBody(request);
    if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    const input = loginSchema.safeParse(body.data);
    if (!input.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit(rateKey("customer-login-ip", clientAddress(request)), 30, 900),
      consumeRateLimit(rateKey("customer-login-email", input.data.email), 10, 900),
    ]);
    if (!ipLimit.allowed || !emailLimit.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429, headers: { "Retry-After": "900" } });
    const user = await db.user.findUnique({ where: { email: input.data.email } });
    const customerEligible = user?.status === "ACTIVE" && user.platformRole === "NONE";
    const passwordOk = await verifyPasswordForLogin(customerEligible ? user.passwordHash : undefined, input.data.password);
    const memberships = user ? await db.tenantUser.findMany({ where: { userId: user.id }, include: { tenant: { include: { subscriptions: { where: { status: { in: ["ACTIVE", "TRIAL"] } }, orderBy: { createdAt: "desc" }, take: 1 } } } } }) : [];
    const now = new Date();
    const membership = memberships.find((item) => item.tenant.status === "ACTIVE" && item.tenant.subscriptions.some((subscription) => subscription.startsAt <= now && (!subscription.endsAt || subscription.endsAt > now)));
    if (!user || !passwordOk || !customerEligible || !membership) {
      return NextResponse.json({ error: "Email or password is incorrect, or the account is not active." }, { status: 401 });
    }
    const token = await issueSession(user.id, request.headers.get("user-agent"));
    const response = NextResponse.json({ ok: true, redirect: "/app" });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Customer sign-in failed", error);
    return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
  }
}
