// Role → route mapping shared by the header and the role-area guards.
//
// The backend `user.role` is only "organization" | "tenant" | "pending"
// (lower-cased in AuthContext). Every organization team member — OWNER,
// MANAGER, AGENT, FINANCE — has `user.role === "organization"`; their actual
// team role lives on `user.organizationRole`. So routing must look at BOTH.

export const ROLE_DASHBOARD = {
  organization: "/admin/dashboard", // OWNER
  manager: "/manager/dashboard",
  agent: "/agent/dashboard",
  finance: "/finance/dashboard",
  operation: "/operation/dashboard",
  tenant: "/tenant/dashboard",
};

// The effective role used for routing + guards:
// "organization" | "manager" | "agent" | "finance" | "operation" | "tenant" | null
export function getEffectiveRole(user) {
  if (!user) return null;
  const base = (user.role || "").toLowerCase();

  if (base === "organization") {
    const sub = (user.organizationRole || "OWNER").toUpperCase();
    switch (sub) {
      case "MANAGER":
        return "manager";
      case "AGENT":
        return "agent";
      case "FINANCE":
        return "finance";
      case "OPERATION":
        return "operation";
      case "OWNER":
      default:
        return "organization"; // owner uses the admin area
    }
  }

  return base || null; // "tenant", etc.
}

// The dashboard path the user should land on. Falls back to home.
export function dashboardPathFor(user) {
  const role = getEffectiveRole(user);
  return ROLE_DASHBOARD[role] || "/";
}
