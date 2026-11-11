import { Prisma } from "@/generated/prisma/client";

export async function lockTenant(tx: Prisma.TransactionClient, tenantId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId}::uuid FOR UPDATE`);
}
