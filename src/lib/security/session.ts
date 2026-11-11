import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOpaqueToken, digestToken } from "@/lib/security/tokens";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cellon_session" : "cellon_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export async function issueSession(userId: string, userAgent?: string | null) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.authSession.create({ data: { userId, tokenHash: digestToken(token), expiresAt, userAgent: userAgent?.slice(0, 500) } });
  return token;
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}

export function verifySameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function sessionUser(token: string | undefined) {
  if (!token || token.length > 256) return null;
  const tokenHash = digestToken(token);
  const session = await db.authSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
  const memberships = await db.tenantUser.findMany({ where: { userId: session.userId }, include: { role: { include: { permissions: { include: { permission: true } } } }, tenant: { include: { subscriptions: { where: { status: { in: ["ACTIVE", "TRIAL"] } }, orderBy: { createdAt: "desc" }, take: 1, include: { plan: { include: { features: true } } } } } } } });
  return { ...session, user: { ...session.user, memberships } };
}

export async function currentBrowserSession() {
  const jar = await cookies();
  return sessionUser(jar.get(SESSION_COOKIE)?.value);
}

export async function currentCustomerMembership() {
  const session = await currentBrowserSession();
  if (!session || session.user.platformRole !== "NONE") return null;
  const now = new Date();
  const membership = session.user.memberships.find((item) => item.tenant.status === "ACTIVE" && item.tenant.subscriptions.some((subscription) => subscription.startsAt <= now && (!subscription.endsAt || subscription.endsAt > now)));
  return membership ? { ...membership, user: session.user } : null;
}

export async function revokeSession(token: string | undefined) {
  if (!token || token.length > 256) return;
  await db.authSession.updateMany({ where: { tokenHash: digestToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
}
