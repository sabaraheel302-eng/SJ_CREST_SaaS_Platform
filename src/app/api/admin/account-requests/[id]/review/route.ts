import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendInformationRequestEmail } from "@/lib/email";
import { requireAdmin, unauthorized } from "@/lib/security/admin";
import { verifySameOrigin } from "@/lib/security/session";
import { parseJsonBody } from "@/lib/http";

const reviewSchema = z.object({ notes: z.string().trim().max(4000).optional(), customerMessage: z.string().trim().max(2000).optional(), status: z.enum(["UNDER_REVIEW", "MORE_INFORMATION_REQUIRED"]) }).refine((data) => data.status !== "MORE_INFORMATION_REQUIRED" || Boolean(data.customerMessage && data.customerMessage.length >= 3), { path: ["customerMessage"], message: "A message for the applicant is required." });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifySameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await context.params;
  const body = await parseJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const input = reviewSchema.safeParse(body.data);
  if (!input.success) return NextResponse.json({ error: "Invalid review update." }, { status: 400 });
  try {
    const result = await db.$transaction(async (tx) => {
      const account = await tx.accountRequest.findFirst({ where: { id, status: { in: ["PENDING", "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED"] } } });
      if (!account) return null;
      const changed = await tx.accountRequest.updateMany({ where: { id, status: { in: ["PENDING", "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED"] } }, data: { status: input.data.status, internalNotes: input.data.notes, reviewedAt: new Date(), approvedById: admin.id } });
      if (!changed.count) return null;
      await tx.auditLog.create({ data: { userId: admin.id, action: "ACCOUNT_REQUEST_REVIEW_UPDATED", entity: "AccountRequest", entityId: id, metadata: { status: input.data.status } } });
      return { email: account.email, ownerName: account.ownerName, businessName: account.businessName, requestNumber: account.requestNumber };
    });
    if (!result) return NextResponse.json({ error: "Request not found or no longer awaiting review." }, { status: 409 });
    if (input.data.status === "MORE_INFORMATION_REQUIRED") {
      try {
        await sendInformationRequestEmail(result.email, result.ownerName, result.businessName, input.data.customerMessage!);
        await db.auditLog.create({ data: { userId: admin.id, action: "MORE_INFORMATION_EMAIL_SENT", entity: "AccountRequest", entityId: id } });
        return NextResponse.json({ ok: true, message: `Information request emailed to ${result.email}.` });
      } catch (emailError) {
        console.error("Information request email delivery failed", { requestId: id, error: emailError instanceof Error ? emailError.message : "unknown" });
        return NextResponse.json({ ok: true, emailSent: false, message: `Status updated to more information required, but email delivery failed for ${result.requestNumber}.` }, { status: 202 });
      }
    }
    return NextResponse.json({ ok: true, message: `Request ${result.requestNumber} moved under review.` });
  } catch (error) {
    console.error("Account request review update failed", error);
    return NextResponse.json({ error: "Could not update this request." }, { status: 503 });
  }
}
