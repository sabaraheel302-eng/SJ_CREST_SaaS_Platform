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
    const ipLimit = await consumeRateLimit(rateKey("admin-login-ip", clientAddress(request)), 20, 900);
    const emailLimit = await consumeRateLimit(rateKey("admin-login-email", input.data.email), 8, 900);
    if (!ipLimit.allowed || !emailLimit.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429, headers: { "Retry-After": "900" } });
    const user = await db.user.findUnique({ where: { email: input.data.email } });
    const adminEligible = user?.status === "ACTIVE" && ["SUPER_ADMIN", "ADMIN"].includes(user.platformRole);
    const passwordOk = await verifyPasswordForLogin(adminEligible ? user.passwordHash : undefined, input.data.password);
    if (!user || !passwordOk || !adminEligible) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    const token = await issueSession(user.id, request.headers.get("user-agent"));
    await db.auditLog.create({ data: { userId: user.id, action: "ADMIN_LOGIN" } });
    const response = NextResponse.json({ ok: true, name: user.name });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Admin sign-in failed", error);
    return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
  }
}
