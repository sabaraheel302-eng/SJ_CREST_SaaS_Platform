import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/security/admin";
import { sendRejectionEmail } from "@/lib/email";
import { verifySameOrigin } from "@/lib/security/session";
import { rejectionSchema } from "@/lib/validation/auth";
import { parseJsonBody } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifySameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await context.params;
  const body = await parseJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const input = rejectionSchema.safeParse(body.data);
  if (!input.success) return NextResponse.json({ error: "Enter a short reason for rejecting this request." }, { status: 400 });
  try {
    const result = await db.$transaction(async (tx) => {
      const record = await tx.accountRequest.findUnique({ where: { id } });
      if (!record || !["PENDING", "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED"].includes(record.status)) throw new Error("REQUEST_NOT_REJECTABLE");
      const changed = await tx.accountRequest.updateMany({ where: { id, status: { in: ["PENDING", "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED"] } }, data: { status: "REJECTED", rejectionReason: input.data.reason, reviewedAt: new Date(), approvedById: admin.id } });
      if (changed.count !== 1) throw new Error("REQUEST_NOT_REJECTABLE");
      await tx.auditLog.create({ data: { userId: admin.id, action: "ACCOUNT_REQUEST_REJECTED", entity: "AccountRequest", entityId: id, metadata: { requestNumber: record.requestNumber, reason: input.data.reason } } });
      return { requestNumber: record.requestNumber, email: record.email, ownerName: record.ownerName, businessName: record.businessName };
    });
    try {
      await sendRejectionEmail(result.email, result.ownerName, result.businessName, input.data.reason);
      await db.auditLog.create({ data: { userId: admin.id, action: "ACCOUNT_REJECTION_EMAIL_SENT", entity: "AccountRequest", entityId: id } });
      return NextResponse.json({ ok: true, message: `Request ${result.requestNumber} rejected; the applicant was notified.` });
    } catch (emailError) {
      console.error("Rejection email delivery failed", { requestId: id, error: emailError instanceof Error ? emailError.message : "unknown" });
      return NextResponse.json({ ok: true, emailSent: false, message: `Request ${result.requestNumber} rejected, but email delivery failed. Contact the applicant manually.` }, { status: 202 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_NOT_REJECTABLE") return NextResponse.json({ error: "This request is no longer awaiting review." }, { status: 409 });
    console.error("Account request rejection failed", error);
    return NextResponse.json({ error: "Could not reject this request." }, { status: 503 });
  }
}
