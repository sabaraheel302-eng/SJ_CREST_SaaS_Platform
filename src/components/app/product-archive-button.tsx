"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProductArchiveButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function archive() {
    if (!window.confirm("Archive this product? Historical records will be retained.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/app/products/${productId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Could not archive product."); setBusy(false); return; }
      router.replace("/app/products"); router.refresh();
    } catch { setError("Could not archive product."); setBusy(false); }
  }
  return <div><button onClick={archive} disabled={busy} className="rounded-lg border border-[#efd8d0] px-3 py-2 text-[12px] font-semibold text-[#a64d38]">{busy ? "Archiving…" : "Archive product"}</button>{error && <p role="alert" className="mt-2 text-[12px] text-[#a64d38]">{error}</p>}</div>;
}
