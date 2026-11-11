export type TenantGrant = {
  tenantId: string;
  tenantStatus: string;
  branchId: string | null;
  roleName: string;
  permissions: string[];
  planFeatures: string[];
  planLimits: Record<string, number>;
  subscriptionActive: boolean;
};

export function resolveTenantGrant(grants: TenantGrant[], input: { tenantId?: string; branchId?: string; permission?: string; feature?: string } = {}) {
  const grant = grants.find((item) => (!input.tenantId || item.tenantId === input.tenantId) && item.tenantStatus === "ACTIVE" && item.subscriptionActive);
  if (!grant) return null;
  if (input.feature && !grant.planFeatures.includes(input.feature)) return null;
  if (input.branchId && grant.roleName !== "Owner" && grant.branchId !== input.branchId) return null;
  if (input.permission && grant.roleName !== "Owner" && !grant.permissions.includes(input.permission)) return null;
  return { tenantId: grant.tenantId, branchId: input.branchId ?? grant.branchId, roleName: grant.roleName, planLimits: grant.planLimits, planFeatures: grant.planFeatures };
}
