"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SignInForm({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch(admin ? "/api/admin/login" : "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Sign-in failed."); setBusy(false); return; }
      router.replace(admin ? "/admin" : "/app"); router.refresh();
    } catch { setError("Sign-in is temporarily unavailable."); setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-6 space-y-4">
    <label className="block text-[12px] font-semibold text-[#52675d]">Email<input className="mt-1.5 w-full rounded-lg border border-[#dfe8e2] px-3 py-2.5 text-[13px] outline-none focus:border-[#0b766e]" name="email" type="email" autoComplete="username" required/></label>
    <label className="block text-[12px] font-semibold text-[#52675d]">Password<input className="mt-1.5 w-full rounded-lg border border-[#dfe8e2] px-3 py-2.5 text-[13px] outline-none focus:border-[#0b766e]" name="password" type="password" autoComplete="current-password" required/></label>
    {error && <p role="alert" className="rounded-lg bg-[#fff0ec] p-3 text-[12px] text-[#a64d38]">{error}</p>}
    <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
  </form>;
}
