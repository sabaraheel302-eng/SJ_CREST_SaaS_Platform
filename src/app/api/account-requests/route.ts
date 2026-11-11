import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accountRequestSchema } from "@/lib/validation/requests";
import { clientAddress, consumeRateLimit, rateKey } from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const limit = await consumeRateLimit(rateKey("account-request", clientAddress(request)), 12, 3600);
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests from this network. Try again later." }, { status: 429, headers: { "Retry-After": "3600" } });
    const body = await parseJsonBody(request);
    if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    const parsed = accountRequestSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "Please check the highlighted details.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const data = parsed.data;
    const emailLimit = await consumeRateLimit(rateKey("account-request-email", data.email), 3, 86400);
    if (!emailLimit.allowed) return NextResponse.json({ error: "An account request for this email was submitted recently." }, { status: 429, headers: { "Retry-After": "86400" } });
    const duplicate = await db.accountRequest.findFirst({ where: { email: data.email, status: { not: "REJECTED" } }, select: { requestNumber: true } });
    if (duplicate) return NextResponse.json({ message: "We already have an open request for this email address.", requestNumber: duplicate.requestNumber }, { status: 409 });
    const result = await db.$transaction(async (tx) => {
      const plan = data.preferredPlan ? await tx.plan.findFirst({ where: { name: { equals: data.preferredPlan, mode: "insensitive" }, isActive: true }, select: { id: true } }) : null;
      const created = await tx.accountRequest.create({ data: { businessName: data.businessName, ownerName: data.ownerName, email: data.email, phone: data.phone, country: data.country, city: data.city, businessType: data.businessType, branchCount: data.branchCount, employeeCount: data.employeeCount, preferredPlanId: plan?.id, additionalDetails: data.additionalDetails } });
      await tx.notification.create({ data: { recipient: "admin", kind: "ACCOUNT_REQUEST_RECEIVED", payload: { requestNumber: created.requestNumber, businessName: created.businessName } } });
      return created;
    });
    return NextResponse.json({ message: "Your request is with our team. We’ll be in touch soon.", requestNumber: result.requestNumber }, { status: 201 });
  } catch (error) {
    console.error("Account request submission failed", error);
    return NextResponse.json({ error: "We couldn’t submit your request right now. Please try again shortly." }, { status: 500 });
  }
}
