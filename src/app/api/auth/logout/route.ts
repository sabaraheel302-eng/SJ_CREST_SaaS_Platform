import { NextResponse } from "next/server";
import { clearSessionCookie, revokeSession, SESSION_COOKIE, verifySameOrigin } from "@/lib/security/session";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    await revokeSession(token);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch {
    return NextResponse.json({ error: "Could not sign out." }, { status: 500 });
  }
}
