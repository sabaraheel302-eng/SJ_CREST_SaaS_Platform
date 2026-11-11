"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type EditableProduct = { id: string; name: string; sku: string | null; brand: string | null; category: string | null; costPrice: number; salePrice: number; trackImei: boolean };

export function ProductForm({ product, imeiEnabled = true }: { product?: EditableProduct; imeiEnabled?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = { ...values, costPrice: Number(values.costPrice || 0), salePrice: Number(values.salePrice || 0), trackImei: imeiEnabled ? values.trackImei === "on" : product?.trackImei ?? false };
    try {
      const response = await fetch(product ? `/api/app/products/${product.id}` : "/api/app/products", { method: product ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Could not save the product."); setBusy(false); return; }
      router.replace(product ? `/app/products/${product.id}` : `/app/products/${result.product.id}`); router.refresh();
    } catch { setError("The product could not be saved right now."); setBusy(false); }
  }
  const field = "mt-1.5 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#0b766e]";
  return <form onSubmit={submit} className="card max-w-2xl space-y-4 p-6">
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-[12px] font-semibold text-[#52675d] sm:col-span-2">Product name<input className={field} name="name" minLength={2} maxLength={160} required defaultValue={product?.name}/></label><label className="text-[12px] font-semibold text-[#52675d]">SKU<input className={field} name="sku" maxLength={64} placeholder="Optional" defaultValue={product?.sku ?? ""}/></label><label className="text-[12px] font-semibold text-[#52675d]">Brand<input className={field} name="brand" maxLength={100} defaultValue={product?.brand ?? ""}/></label><label className="text-[12px] font-semibold text-[#52675d]">Category<input className={field} name="category" maxLength={100} placeholder="Phone, accessory…" defaultValue={product?.category ?? ""}/></label><label className="text-[12px] font-semibold text-[#52675d]">Cost price<input className={field} name="costPrice" type="number" min="0" max="999999999.99" step="0.01" defaultValue={product?.costPrice ?? 0}/></label><label className="text-[12px] font-semibold text-[#52675d]">Sale price<input className={field} name="salePrice" type="number" min="0" max="999999999.99" step="0.01" defaultValue={product?.salePrice ?? 0}/></label></div>
    <label className="flex items-start gap-3 rounded-lg bg-[#f5f8f5] p-4 text-[12px] text-[#52675d]"><input name="trackImei" type="checkbox" disabled={!imeiEnabled} defaultChecked={product?.trackImei ?? false} className="mt-0.5 accent-[#0b766e]"/><span><strong className="block">Track each device by IMEI</strong><span className="mt-1 block text-[#7b8c83]">{imeiEnabled ? "Enable for phones and other devices with unique identifiers." : "IMEI tracking is not included in this shop’s current plan."}</span></span></label>
    {error && <p role="alert" className="rounded-lg bg-[#fff0ec] p-3 text-[12px] text-[#a64d38]">{error}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={busy} className="btn btn-primary">{busy ? "Saving…" : product ? "Save changes" : "Create product"}</button><Link href={product ? `/app/products/${product.id}` : "/app/products"} className="btn btn-secondary">Cancel</Link></div>
  </form>;
}
