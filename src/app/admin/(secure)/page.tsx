import Link from "next/link";
import { db } from "@/lib/db";

export default async function AdminDashboardPage() {
  const [pending, tenants, active, suspended] = await Promise.all([
    db.accountRequest.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED"] } } }),
    db.tenant.count(), db.tenant.count({ where: { status: "ACTIVE" } }), db.tenant.count({ where: { status: "SUSPENDED" } }),
  ]);
  const metrics = [["Pending requests", pending], ["Total shops", tenants], ["Active shops", active], ["Suspended shops", suspended]] as const;
  return <><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Platform overview</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Admin dashboard</h1></div><Link href="/admin/account-requests" className="btn btn-primary">Review account requests</Link></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value])=><div key={label} className="card p-5"><p className="text-[12px] text-[#75857e]">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div><section className="card mt-6 p-6"><h2 className="text-[16px] font-bold">Account lifecycle</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#75857e]">Review requests, assign a plan and term, provision a shop workspace, and send its owner a one-time activation link.</p><Link href="/admin/account-requests" className="mt-4 inline-flex text-[13px] font-bold text-[#0b766e]">Open request queue →</Link></section></>;
}
