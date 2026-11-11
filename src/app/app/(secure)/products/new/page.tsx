import Link from "next/link";
import { ProductForm } from "@/components/app/product-form";
import { currentCustomerMembership } from "@/lib/security/session";

export default async function NewProductPage() {
  const membership = await currentCustomerMembership();
  if (!membership) return null;
  const enabled = membership.tenant.subscriptions[0]?.plan.features.some((feature) => feature.key === "inventory" && feature.enabled);
  const imeiEnabled = membership.tenant.subscriptions[0]?.plan.features.some((feature) => feature.key === "imei" && feature.enabled) ?? false;
  const allowed = membership.role.name === "Owner" || membership.role.permissions.some((entry) => entry.permission.key === "inventory:create");
  if (!enabled || !allowed) return <section className="card p-7"><h1 className="text-2xl font-bold">You do not have access to create products.</h1><p className="mt-2 text-[13px] text-[#75857e]">Check your plan or ask your shop owner for access.</p><Link href="/app/products" className="btn btn-secondary mt-4">Back to products</Link></section>;
  return <><Link href="/app/products" className="text-[13px] font-semibold text-[#0b766e]">← Products</Link><p className="eyebrow mt-6">Inventory catalog</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Add a product</h1><p className="mb-5 mt-2 text-[13px] text-[#75857e]">The product is saved inside the currently authenticated shop.</p><ProductForm imeiEnabled={imeiEnabled}/></>;
}
