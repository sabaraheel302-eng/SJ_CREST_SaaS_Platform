import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export function clientAddress(request: Request) {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function rateKey(scope: string, value: string) {
  const digest = createHash("sha256").update(value.toLowerCase()).digest("hex");
  return `${scope}:${digest}`;
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const rows = await db.$queryRaw<{ hits: number; windowStartedAt: Date }[]>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "hits", "windowStartedAt", "updatedAt")
    VALUES (${key}, 1, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "RateLimitBucket"."windowStartedAt" <= NOW() - (${windowSeconds} * INTERVAL '1 second') THEN 1 ELSE "RateLimitBucket"."hits" + 1 END,
      "windowStartedAt" = CASE WHEN "RateLimitBucket"."windowStartedAt" <= NOW() - (${windowSeconds} * INTERVAL '1 second') THEN NOW() ELSE "RateLimitBucket"."windowStartedAt" END,
      "updatedAt" = NOW()
    RETURNING "hits", "windowStartedAt"
  `);
  return { allowed: (rows[0]?.hits ?? limit + 1) <= limit, retryAfter: windowSeconds };
}
