"use client";

import { FormEvent, useState } from "react";

type PlanOption = { id: string; name: string; features: { key: string; limit: number | null }[] };
export function RequestActions({ id, status, plans, preferredPlanId }: { id: string; status: string; plans: PlanOption[]; preferredPlanId?: string | null }) {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const canReview = ["PENDING", "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED"].includes(status);
  async function send(url: string, data: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json(); setNotice(result.message ?? result.error ?? "Done.");
      if (response.ok) window.location.reload();
    } catch { setNotice("The request could not be completed."); }
    finally { setBusy(false); }
  }
  function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    void send(`/api/admin/account-requests/${id}/approve`, values, "Approve this request and provision its shop account?");
  }
  function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    void send(`/api/admin/account-requests/${id}/reject`, values, "Reject this account request?");
  }
  function review(statusValue: "UNDER_REVIEW" | "MORE_INFORMATION_REQUIRED") {
    const notes = (document.getElementById("review-notes") as HTMLTextAreaElement | null)?.value ?? "";
    const customerMessage = (document.getElementById("customer-message") as HTMLTextAreaElement | null)?.value ?? "";
    void send(`/api/admin/account-requests/${id}/review`, { notes, customerMessage, status: statusValue });
  }
  return <div className="space-y-5">
    {canReview && <>
      <form onSubmit={approve} className="rounded-xl border border-[#e8eeea] p-5">
        <h3 className="font-bold">Approve and provision</h3>
        <p className="mt-1 text-[12px] text-[#839189]">Plan limits are checked against this request.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] font-semibold text-[#52675d]">Plan
            <select name="planId" className="mt-1 block w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2.5" required defaultValue={preferredPlanId ?? ""}>
              <option value="" disabled>Select plan</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.features.find((feature) => feature.key === "maxBranches")?.limit ?? 1} branches · {plan.features.find((feature) => feature.key === "maxEmployees")?.limit ?? 1} employees</option>)}
            </select>
          </label>
          <label className="text-[12px] font-semibold text-[#52675d]">Subscription term
            <select name="termMonths" className="mt-1 block w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2.5" defaultValue="12">{[1, 3, 6, 12, 24, 36].map((months) => <option key={months} value={months}>{months} months</option>)}</select>
          </label>
        </div>
        <label className="mt-3 block text-[12px] font-semibold text-[#52675d]">Internal note<textarea name="internalNotes" maxLength={4000} className="mt-1 block min-h-20 w-full rounded-lg border border-[#dfe8e2] px-3 py-2.5"/></label>
        <button disabled={busy} className="btn btn-primary mt-4">{busy ? "Working…" : "Approve & send activation"}</button>
      </form>
      <div className="rounded-xl border border-[#e8eeea] p-5">
        <h3 className="font-bold">Review</h3>
        <label className="mt-3 block text-[12px] font-semibold text-[#52675d]">Internal notes<textarea id="review-notes" maxLength={4000} className="mt-1 min-h-20 w-full rounded-lg border border-[#dfe8e2] px-3 py-2.5 text-[13px]"/></label>
        <label className="mt-3 block text-[12px] font-semibold text-[#52675d]">Message to applicant<textarea id="customer-message" maxLength={2000} className="mt-1 min-h-20 w-full rounded-lg border border-[#dfe8e2] px-3 py-2.5 text-[13px]"/></label>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => review("UNDER_REVIEW")} className="btn btn-secondary">Mark under review</button><button type="button" disabled={busy} onClick={() => review("MORE_INFORMATION_REQUIRED")} className="btn btn-secondary">Request more information</button></div>
      </div>
      <form onSubmit={reject} className="rounded-xl border border-[#f0ded8] p-5"><h3 className="font-bold">Reject request</h3><label className="mt-3 block text-[12px] font-semibold text-[#52675d]">Reason<textarea name="reason" minLength={3} maxLength={2000} required className="mt-1 block min-h-20 w-full rounded-lg border border-[#dfe8e2] px-3 py-2.5"/></label><button disabled={busy} className="btn mt-3 bg-[#fff0ec] text-[#a64d38]">Reject & notify applicant</button></form>
    </>}
    {status === "ACTIVATION_PENDING" && <div className="rounded-xl border border-[#e8eeea] p-5"><h3 className="font-bold">Activation invitation</h3><p className="mt-1 text-[12px] text-[#839189]">Send a new one-time invitation link. Previous unused links will be revoked.</p><button disabled={busy} onClick={() => send(`/api/admin/account-requests/${id}/activation`, {}, "Send a new activation link and revoke earlier unused links?")} className="btn btn-primary mt-4">Resend activation email</button></div>}
    {notice && <p role="status" className="rounded-lg bg-[#eef5ef] p-3 text-[12px] text-[#44685b]">{notice}</p>}
  </div>;
}
