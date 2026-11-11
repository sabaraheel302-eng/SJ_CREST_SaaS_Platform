import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { currentCustomerMembership } from "@/lib/security/session";

export default async function CustomerAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const membership = await currentCustomerMembership();
  if (!membership) redirect("/login");
  return <div className="min-h-screen bg-[#f5f8f5]"><header className="border-b border-[#e5ece7] bg-white"><div className="wrap flex h-16 items-center justify-between"><div className="flex items-center gap-8"><Link href="/app" className="font-extrabold text-[#0b766e]">CellOn</Link><nav className="flex gap-5 text-[13px] text-[#52675d]"><Link href="/app">Overview</Link><Link href="/app/products">Products</Link></nav></div><div className="flex items-center gap-4"><span className="hidden text-[12px] text-[#72837a] sm:block">{membership.tenant.name}</span><LogoutButton/></div></div></header><main className="wrap py-8">{children}</main></div>;
}
