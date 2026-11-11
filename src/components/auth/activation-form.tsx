"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function ActivationForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/auth/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, token }) });
      const data = await response.json(); setSuccess(response.ok); setMessage(data.message ?? data.error ?? "Activation failed."); setBusy(false);
      if (response.ok) form.reset();
    } catch { setMessage("Activation is temporarily unavailable."); setSuccess(false); setBusy(false); }
  }
  if (!token) return <p className="mt-5 rounded-lg bg-[#fff0ec] p-4 text-[13px] text-[#a64d38]">This link is missing its activation token. Ask your administrator to send a new invitation.</p>;
  return <form onSubmit={submit} className="mt-6 space-y-4">
    <label className="block text-[12px] font-semibold text-[#52675d]">New password<input className="mt-1.5 w-full rounded-lg border border-[#dfe8e2] px-3 py-2.5 text-[13px]" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label>
    <label className="block text-[12px] font-semibold text-[#52675d]">Confirm password<input className="mt-1.5 w-full rounded-lg border border-[#dfe8e2] px-3 py-2.5 text-[13px]" name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label>
    <p className="text-[11px] text-[#7b8c83]">Use at least 12 characters with both letters and numbers.</p>
    {message && <p role="status" className={`rounded-lg p-3 text-[12px] ${success ? "bg-[#e6f5eb] text-[#176e53]" : "bg-[#fff0ec] text-[#a64d38]"}`}>{message}</p>}
    {success ? <Link className="btn btn-primary w-full" href="/login">Continue to sign in</Link> : <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Activating…" : "Activate account"}</button>}
  </form>;
}
