"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace(redirectTo); router.refresh();
  }
  return <button onClick={logout} disabled={busy} className="rounded-lg border border-[#dfe8e2] px-3 py-2 text-[12px] font-semibold text-[#52675d]">{busy ? "Signing out…" : "Sign out"}</button>;
}
