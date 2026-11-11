import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentCustomerMembership } from "@/lib/security/session";

export default async function CustomerDashboardPage() {
  const membership = await currentCustomerMembership();
  if (!membership) redirect("/login");
  const tenant = await db.tenant.findUnique({ where: { id: membership.tenantId }, include: { serialNumber: true, subscriptions: { where: { status: { in: ["ACTIVE", "TRIAL"] } }, orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } } } });
  if (!tenant || tenant.status !== "ACTIVE") redirect("/login");
  const subscription = tenant.subscriptions[0];
  return <><p className="eyebrow">Shop workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome, {membership.user.name}</h1><p className="mt-2 text-[14px] text-[#75857e]">Your shop workspace is active. Product and IMEI workflows are the next build phase.</p><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><section className="card p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-[#9aa69f]">Business</p><h2 className="mt-2 text-[17px] font-bold">{tenant.name}</h2><p className="mt-1 text-[12px] text-[#75857e]">{tenant.city ? `${tenant.city}, ${tenant.country ?? ""}` : tenant.country}</p></section><section className="card p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-[#9aa69f]">Shop serial number</p><h2 className="mt-2 font-mono text-[17px] font-bold">{tenant.serialNumber?.value ?? "—"}</h2><p className="mt-1 text-[12px] text-[#75857e]">Identifier only · never used to sign in</p></section><section className="card p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-[#9aa69f]">Subscription</p><h2 className="mt-2 text-[17px] font-bold">{subscription?.plan.name ?? "No active plan"}</h2><p className="mt-1 text-[12px] text-[#75857e]">{subscription?.endsAt ? `Renews or expires ${subscription.endsAt.toLocaleDateString()}` : "Contact support for subscription details"}</p></section></div><section className="card mt-6 p-6"><h2 className="text-[16px] font-bold">Your workspace is ready</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#75857e]">Inventory, device IMEI records, purchases and sales will appear here as those secure workflows are released.</p></section></>;
}
