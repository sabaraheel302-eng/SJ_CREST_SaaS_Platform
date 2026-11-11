import Link from "next/link";
import { ActivationForm } from "@/components/auth/activation-form";

export default async function ActivateAccountPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="grid min-h-screen place-items-center px-4 py-12"><div className="card w-full max-w-[460px] p-8"><Link href="/" className="text-[13px] text-[#62766c]">← CellOn home</Link><h1 className="mt-8 text-3xl font-bold tracking-tight">Activate your account</h1><p className="mt-2 text-[13px] leading-5 text-[#75857e]">Choose a password to activate your shop’s secure CellOn workspace.</p><ActivationForm token={token}/></div></main>;
}
