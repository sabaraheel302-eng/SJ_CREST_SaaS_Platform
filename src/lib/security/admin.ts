import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionUser } from "@/lib/security/session";

export async function requireAdmin(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const session = await sessionUser(token);
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.platformRole)) return null;
  return session.user;
}

export function unauthorized() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function writeAudit(action: string, userId: string, metadata?: Record<string, unknown>) {
  await db.auditLog.create({ data: { action, userId, metadata: metadata as object | undefined } });
}
