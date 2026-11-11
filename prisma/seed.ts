import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, isStrongPassword } from "../src/lib/security/passwords";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  for (const [sortOrder, name, description, maxBranches, maxEmployees, maxProducts, maxImeiDevices] of [
    [0, "Basic", "Essentials for one mobile shop", 1, 1, 100, 1000],
    [1, "Plus", "More room for teams and branches", 5, 25, 2500, 20000],
    [2, "Pro", "Advanced tools for busy operations", 50, 100, 20000, 250000],
  ] as const) {
    const plan = await prisma.plan.upsert({ where: { name }, update: { description, sortOrder }, create: { name, description, sortOrder, currency: "PKR", priceMonthly: 0 } });
    for (const [key, limit] of [["maxBranches", maxBranches], ["maxEmployees", maxEmployees], ["maxProducts", maxProducts], ["maxImeiDevices", maxImeiDevices]] as const) {
      await prisma.planFeature.upsert({ where: { planId_key: { planId: plan.id, key } }, update: { enabled: true, limit }, create: { planId: plan.id, key, enabled: true, limit } });
    }
    const moduleFeatures = ["inventory", "imei", "sales", "purchases", "customers", "suppliers", "reports", ...(sortOrder >= 1 ? ["branches", "employees"] : []), ...(sortOrder >= 2 ? ["advancedReports", "branchTransfers"] : [])];
    for (const key of moduleFeatures) {
      await prisma.planFeature.upsert({ where: { planId_key: { planId: plan.id, key } }, update: { enabled: true }, create: { planId: plan.id, key, enabled: true } });
    }
  }
  await prisma.websiteContent.upsert({
    where: { key: "home.hero" },
    update: {},
    create: { key: "home.hero", title: "Homepage hero", status: "PUBLISHED", publishedAt: new Date(), body: { heading: "Manage your mobile shop smarter.", description: "Inventory, IMEI numbers, sales and business reports, connected in one secure place built for the way mobile shops work." } },
  });
  await prisma.role.upsert({ where: { name: "Owner" }, update: {}, create: { name: "Owner" } });
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || !isStrongPassword(password)) throw new Error("Set ADMIN_EMAIL and a strong ADMIN_PASSWORD (12+ characters with letters and numbers) before seeding the initial Super Admin.");
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, platformRole: true } });
  if (existing && existing.platformRole !== "SUPER_ADMIN") throw new Error("ADMIN_EMAIL already belongs to a non-Super Admin account. Choose a different email.");
  if (!existing) {
    await prisma.user.create({ data: { email, name: process.env.ADMIN_NAME?.trim() || "Platform Administrator", passwordHash: await hashPassword(password), status: "ACTIVE", platformRole: "SUPER_ADMIN" } });
  }
}
main().finally(() => prisma.$disconnect());
