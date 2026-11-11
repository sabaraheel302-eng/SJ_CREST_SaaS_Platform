import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { currentBrowserSession } from "@/lib/security/session";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await currentBrowserSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.platformRole)) redirect("/admin/login");
  return <div className="min-h-screen bg-[#f5f8f5]"><header className="border-b border-[#e5ece7] bg-white"><div className="wrap flex h-16 items-center justify-between"><div className="flex items-center gap-8"><Link href="/admin" className="font-extrabold text-[#0b766e]">CellOn Admin</Link><nav className="flex gap-5 text-[13px] text-[#52675d]"><Link href="/admin">Overview</Link><Link href="/admin/account-requests">Account requests</Link></nav></div><div className="flex items-center gap-4"><span className="hidden text-[12px] text-[#72837a] sm:block">{session.user.name}</span><LogoutButton redirectTo="/admin/login"/></div></div></header><main className="wrap py-8">{children}</main></div>;
}
