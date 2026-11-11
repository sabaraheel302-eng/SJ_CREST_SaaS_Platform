"use client";

import { FormEvent, useState } from "react";

export function ImeiReceiptForm({ productId, branches }: { productId: string; branches: { id: string; name: string }[] }) {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const devices = String(data.get("devices") ?? "").split(/\r?\n/).map((row) => row.trim()).filter(Boolean).map((row) => {
      const [imei, imei2] = row.split(/[\s,;]+/).filter(Boolean);
      return { imei, ...(imei2 ? { imei2 } : {}) };
    });
    try {
      const response = await fetch(`/api/app/products/${productId}/imei`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId: data.get("branchId"), devices }) });
      const result = await response.json(); setSuccess(response.ok); setMessage(result.message ?? result.error ?? (response.ok ? `${result.received} devices recorded.` : "Could not receive devices.")); setBusy(false);
      if (response.ok) { form.reset(); window.location.reload(); }
    } catch { setSuccess(false); setMessage("Could not save the IMEI records."); setBusy(false); }
  }
  return <form onSubmit={submit} className="card p-5">
    <h2 className="font-bold">Receive devices</h2><p className="mt-1 text-[12px] text-[#839189]">Enter one device per line. Add an optional second IMEI after a comma.</p>
    <label className="mt-4 block text-[12px] font-semibold text-[#52675d]">Branch<select name="branchId" required defaultValue="" className="mt-1 block w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2.5">{branches.map((branch)=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    <label className="mt-4 block text-[12px] font-semibold text-[#52675d]">IMEI numbers<textarea name="devices" required rows={6} placeholder="490154203237518, 490154203237526" className="mt-1 block w-full rounded-lg border border-[#dfe8e2] px-3 py-2.5 font-mono text-[12px]"/></label>
    {message && <p role="status" className={`mt-3 rounded-lg p-3 text-[12px] ${success ? "bg-[#e6f5eb] text-[#176e53]" : "bg-[#fff0ec] text-[#a64d38]"}`}>{message}</p>}
    <button disabled={busy || branches.length === 0} className="btn btn-primary mt-4">{busy ? "Saving…" : "Receive into inventory"}</button>
  </form>;
}
