import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoRequestSchema } from "@/lib/validation/requests";
import { clientAddress, consumeRateLimit, rateKey } from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const limit = await consumeRateLimit(rateKey("demo-request", clientAddress(request)), 12, 3600);
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests from this network. Try again later." }, { status: 429, headers: { "Retry-After": "3600" } });
    const body = await parseJsonBody(request);
    if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    const parsed = demoRequestSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "Please check the submitted details.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const data = parsed.data;
    const emailLimit = await consumeRateLimit(rateKey("demo-request-email", data.email), 4, 86400);
    if (!emailLimit.allowed) return NextResponse.json({ error: "A demo request for this email was submitted recently." }, { status: 429, headers: { "Retry-After": "86400" } });
    const created = await db.$transaction(async (tx) => {
      const demo = await tx.demoRequest.create({ data: { name: data.name, businessName: data.businessName, email: data.email, phone: data.phone, country: data.country, city: data.city, preferredPlan: data.preferredPlan, preferredAt: data.preferredAt ? new Date(data.preferredAt) : null, message: data.message } });
      await tx.notification.create({ data: { recipient: "admin", kind: "DEMO_REQUEST_RECEIVED", payload: { id: demo.id, businessName: demo.businessName } } });
      return demo;
    });
    return NextResponse.json({ message: "Thanks. Our team will contact you to arrange your demo.", id: created.id }, { status: 201 });
  } catch (error) {
    console.error("Demo request submission failed", error);
    return NextResponse.json({ error: "We couldn’t submit your request right now. Please try again shortly." }, { status: 500 });
  }
}
