import { db } from "@/lib/db";

export async function publicContent<T>(key: string, fallback: T): Promise<T> {
  if (!process.env.DATABASE_URL) return fallback;
  try {
    const content = await db.websiteContent.findFirst({ where: { key, status: "PUBLISHED" }, select: { body: true } });
    return content?.body as T ?? fallback;
  } catch {
    // The public site remains available while a new deployment is being initialized.
    return fallback;
  }
}
