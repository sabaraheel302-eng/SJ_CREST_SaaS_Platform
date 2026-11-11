"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type FormKind = "account" | "demo";

export function RequestForm({ kind }: { kind: FormKind }) {
  const [state, setState] = useState<{ busy: boolean; message: string; success: boolean }>({ busy: false, message: "", success: false });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ busy: true, message: "", success: false });
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(kind === "account" ? "/api/account-requests" : "/api/demo-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      setState({ busy: false, message: result.message ?? result.error ?? "Something went wrong.", success: response.ok });
      if (response.ok) form.reset();
    } catch {
      setState({ busy: false, message: "We couldn’t connect. Please try again.", success: false });
    }
  }

  const input = "mt-1.5 w-full rounded-lg border border-[#dfe8e2] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#0b766e] focus:ring-2 focus:ring-[#0b766e18]";
  return <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
    <div className="grid gap-4 sm:grid-cols-2">
      {kind === "demo" && <Field label="Your name" name="name" required className={input}/>}
      <Field label="Business name" name="businessName" required className={input}/>
      {kind === "account" && <Field label="Owner name" name="ownerName" required className={input}/>}
      <Field label="Email" name="email" type="email" required className={input}/>
      <Field label="Phone" name="phone" type="tel" required className={input}/>
      <Field label="Country" name="country" required className={input}/>
      <Field label="City" name="city" required className={input}/>
      {kind === "account" ? <><Field label="Business type" name="businessType" placeholder="Retailer, wholesaler…" required className={input}/><Field label="Branches" name="branchCount" type="number" min="1" defaultValue="1" required className={input}/><Field label="Employees" name="employeeCount" type="number" min="1" defaultValue="1" required className={input}/></> : <><label className="block text-[12px] font-semibold text-[#52675d]">Preferred date and time<input className={input} name="preferredAt" type="datetime-local"/></label><Field label="Preferred plan" name="preferredPlan" placeholder="Basic, Plus, or Pro" className={input}/></>}
      {kind === "account" && <Field label="Preferred plan" name="preferredPlan" placeholder="Basic, Plus, or Pro" className={input}/>}
      <label className="block text-[12px] font-semibold text-[#52675d] sm:col-span-2">{kind === "account" ? "Anything else we should know?" : "Message"}<textarea className={`${input} min-h-24 resize-y`} name={kind === "account" ? "additionalDetails" : "message"} maxLength={3000}/></label>
    </div>
    {state.message && <p role="status" className={`flex items-start gap-2 rounded-lg p-3 text-[13px] ${state.success ? "bg-[#e6f5eb] text-[#176e53]" : "bg-[#fff0ec] text-[#a64d38]"}`}>{state.success && <CheckCircle2 size={17} className="shrink-0"/>}{state.message}</p>}
    <button className="btn btn-primary w-full sm:w-auto" disabled={state.busy}>{state.busy ? "Sending…" : kind === "account" ? "Send account request" : "Request my demo"}<ArrowRight size={15}/></button>
    <p className="text-[11px] leading-5 text-[#8a9991]">We’ll only use these details to respond to your request.</p>
  </form>;
}

function Field({ label, name, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block text-[12px] font-semibold text-[#52675d]">{label}<input name={name} className={className} {...props}/></label>;
}
