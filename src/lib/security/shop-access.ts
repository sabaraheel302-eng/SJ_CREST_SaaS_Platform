import { SESSION_COOKIE, sessionUser } from "@/lib/security/session";
import { resolveTenantGrant } from "@/lib/security/tenant-access";
import { db } from "@/lib/db";

export async function requireShopAccess(request: Request, input: { tenantId?: string; branchId?: string; permission?: string; feature?: string } = {}) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const session = await sessionUser(token);
  if (!session || session.user.platformRole !== "NONE") return null;
  const now = new Date();
  const grants = session.user.memberships.map((membership) => ({
    tenantId: membership.tenantId,
    tenantStatus: membership.tenant.status,
    branchId: membership.branchId,
    roleName: membership.role.name,
    permissions: membership.role.permissions.map((row) => row.permission.key),
    planFeatures: membership.tenant.subscriptions.flatMap((subscription) => subscription.plan.features.filter((feature) => feature.enabled).map((feature) => feature.key)),
    planLimits: Object.fromEntries(membership.tenant.subscriptions.flatMap((subscription) => subscription.plan.features.filter((feature) => feature.enabled && feature.limit !== null).map((feature) => [feature.key, feature.limit!]))),
    subscriptionActive: membership.tenant.subscriptions.some((subscription) => subscription.startsAt <= now && (!subscription.endsAt || subscription.endsAt > now)),
  }));
  const resolved = resolveTenantGrant(grants, input);
  const branchId = input.branchId ?? resolved?.branchId;
  if (resolved && branchId) {
    const branch = await db.branch.findFirst({ where: { id: branchId, tenantId: resolved.tenantId, isActive: true }, select: { id: true } });
    if (!branch) return null;
  }
  return resolved ? { ...resolved, userId: session.userId } : null;
}
