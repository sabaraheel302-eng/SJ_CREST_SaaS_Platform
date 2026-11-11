import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function CustomerLoginPage() {
  return <main className="grid min-h-screen place-items-center px-4 py-12"><div className="card w-full max-w-[430px] p-8"><Link href="/" className="text-[13px] text-[#62766c]">← CellOn home</Link><span className="mt-8 grid size-11 place-items-center rounded-xl bg-[#e4f3e9] text-[#0b766e]"><LockKeyhole size={20}/></span><h1 className="mt-5 text-3xl font-bold tracking-tight">Sign in to CellOn</h1><p className="mt-2 text-[13px] leading-5 text-[#75857e]">Use the email address and password you set when activating your shop account.</p><SignInForm/><p className="mt-5 text-center text-[12px] text-[#87958e]">Need a shop account? <Link className="font-bold text-[#0b766e]" href="/request-account">Request access</Link></p></div></main>;
}
