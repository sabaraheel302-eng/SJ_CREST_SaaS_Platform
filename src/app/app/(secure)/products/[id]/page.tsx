import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/app/product-form";
import { ProductArchiveButton } from "@/components/app/product-archive-button";
import { ImeiReceiptForm } from "@/components/app/imei-receipt-form";
import { currentCustomerMembership } from "@/lib/security/session";
import { db } from "@/lib/db";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await currentCustomerMembership();
  if (!membership) return null;
  const plan = membership.tenant.subscriptions[0]?.plan;
  const inventoryEnabled = Boolean(plan?.features.some((feature) => feature.key === "inventory" && feature.enabled));
  const canRead = membership.role.name === "Owner" || membership.role.permissions.some((entry) => entry.permission.key === "inventory:read");
  if (!inventoryEnabled || !canRead) return <section className="card p-7"><h1 className="text-2xl font-bold">You do not have access to this product.</h1><p className="mt-2 text-[13px] text-[#75857e]">Check your plan or ask your shop owner for access.</p><Link href="/app/products" className="btn btn-secondary mt-4">Back to products</Link></section>;
  const product = await db.product.findFirst({ where: { id, tenantId: membership.tenantId, archivedAt: null } });
  if (!product) notFound();
  const branchFilter = membership.branchId ? { branchId: membership.branchId } : {};
  const canReadImei = Boolean(plan?.features.some((feature) => feature.key === "imei" && feature.enabled));
  const [inStock, devices, branches] = await Promise.all([
    product.trackImei && canReadImei ? db.iMEIDevice.count({ where: { tenantId: membership.tenantId, productId: id, status: "IN_STOCK", ...branchFilter } }) : Promise.resolve(0),
    product.trackImei && canReadImei ? db.iMEIDevice.findMany({ where: { tenantId: membership.tenantId, productId: id, ...branchFilter }, orderBy: { createdAt: "desc" }, take: 100, include: { branch: { select: { name: true } } } }) : Promise.resolve([]),
    membership.branchId ? db.branch.findMany({ where: { id: membership.branchId, tenantId: membership.tenantId, isActive: true }, select: { id: true, name: true } }) : db.branch.findMany({ where: { tenantId: membership.tenantId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const canReceiveImei = product.trackImei && canReadImei && (membership.role.name === "Owner" || membership.role.permissions.some((entry) => entry.permission.key === "inventory:receive"));
  const canUpdate = membership.role.name === "Owner" || membership.role.permissions.some((entry) => entry.permission.key === "inventory:update");
  const canArchive = membership.role.name === "Owner" || membership.role.permissions.some((entry) => entry.permission.key === "inventory:delete");
  return <><Link href="/app/products" className="text-[13px] font-semibold text-[#0b766e]">← Products</Link><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_390px]"><div className="space-y-5"><section className="card p-6"><p className="eyebrow">Product detail</p><h1 className="mt-2 text-3xl font-bold">{product.name}</h1><dl className="mt-6 grid gap-4 sm:grid-cols-2"><div><dt className="text-[10px] font-bold uppercase tracking-wider text-[#9aa69f]">SKU</dt><dd className="mt-1 text-[13px]">{product.sku??"—"}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wider text-[#9aa69f]">Brand</dt><dd className="mt-1 text-[13px]">{product.brand??"—"}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wider text-[#9aa69f]">Cost / sale price</dt><dd className="mt-1 text-[13px]">{product.costPrice.toString()} / {product.salePrice.toString()}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wider text-[#9aa69f]">Device tracking</dt><dd className="mt-1 text-[13px]">{product.trackImei?"IMEI tracked":"Standard item"}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wider text-[#9aa69f]">In stock</dt><dd className="mt-1 text-[13px]">{product.trackImei?(canReadImei?inStock:"IMEI tracking is not included in this plan") : "Stock intake will be recorded through purchases."}</dd></div></dl>{canArchive&&<div className="mt-5 border-t border-[#edf1ed] pt-4"><ProductArchiveButton productId={product.id}/></div>}</section>{product.trackImei&&canReadImei&&<section className="card overflow-hidden"><div className="border-b border-[#edf1ed] p-5"><h2 className="font-bold">IMEI devices</h2><p className="mt-1 text-[12px] text-[#839189]">{devices.length} recent device records{devices.length===100?" · showing latest 100":""}</p></div>{devices.length?<div className="divide-y divide-[#edf1ed]">{devices.map((device)=><div key={device.id} className="grid grid-cols-[1fr_.8fr_.7fr] gap-3 px-5 py-3 text-[12px]"><span className="font-mono">{device.imei}{device.imei2&&<small className="mt-1 block text-[#8a9991]">2nd: {device.imei2}</small>}</span><span className="text-[#75857e]">{device.branch?.name??"—"}</span><span>{device.status.replaceAll("_"," ")}</span></div>)}</div>:<p className="p-6 text-[13px] text-[#839189]">No devices have been received for this product.</p>}</section>}{canUpdate&&<section><h2 className="mb-3 text-[16px] font-bold">Edit product</h2><ProductForm product={{ id: product.id, name: product.name, sku: product.sku, brand: product.brand, category: product.category, costPrice: Number(product.costPrice), salePrice: Number(product.salePrice), trackImei: product.trackImei }} imeiEnabled={canReadImei}/></section>}</div>{canReceiveImei&&<ImeiReceiptForm productId={product.id} branches={branches}/>}</div></>;
}
