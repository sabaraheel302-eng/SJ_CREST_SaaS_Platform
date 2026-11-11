import nodemailer from "nodemailer";

function transporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const from = process.env.SMTP_FROM;
  if (!host || !from || !Number.isFinite(port)) throw new Error("SMTP is not configured (SMTP_HOST, SMTP_PORT, SMTP_FROM required).");
  return { client: nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined }), from };
}

export async function sendActivationEmail(to: string, businessName: string, token: string) {
  const { client, from } = transporter();
  const baseUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = new URL("/activate-account", baseUrl);
  link.searchParams.set("token", token);
  await client.sendMail({
    from, to, subject: `Activate your ${businessName} CellOn account`,
    text: `Your account for ${businessName} has been approved. Set your password using this one-time link: ${link.toString()} (valid for 24 hours). If you did not request this account, ignore this email.`,
    html: `<p>Your account for <strong>${escapeHtml(businessName)}</strong> has been approved.</p><p><a href="${escapeHtml(link.toString())}">Set your password</a></p><p>This one-time link expires in 24 hours. If you did not request this account, ignore this email.</p>`,
  });
}

export async function sendRejectionEmail(to: string, ownerName: string, businessName: string, reason: string) {
  const { client, from } = transporter();
  await client.sendMail({
    from, to, subject: `Update about your CellOn account request`,
    text: `Hello ${ownerName}, we are unable to approve the CellOn account request for ${businessName} at this time. Reason: ${reason}`,
    html: `<p>Hello ${escapeHtml(ownerName)},</p><p>We are unable to approve the CellOn account request for <strong>${escapeHtml(businessName)}</strong> at this time.</p><p>Reason: ${escapeHtml(reason)}</p>`,
  });
}

export async function sendInformationRequestEmail(to: string, ownerName: string, businessName: string, message: string) {
  const { client, from } = transporter();
  await client.sendMail({
    from, to, subject: "More information needed for your CellOn account request",
    text: `Hello ${ownerName}, we need a little more information to review the account request for ${businessName}:\n\n${message}`,
    html: `<p>Hello ${escapeHtml(ownerName)},</p><p>We need a little more information to review the account request for <strong>${escapeHtml(businessName)}</strong>:</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
