"use client";

import { LayoutDashboard, Home, Users, Wrench, ShieldCheck, BarChart3 } from "lucide-react";
import RoleShell from "../Shared/RoleShell";

const NAV = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/properties", label: "Properties", icon: Home },
  { href: "/manager/team", label: "Team", icon: Users },
  { href: "/manager/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/manager/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/manager/reports", label: "Reports", icon: BarChart3 },
];

export default function ManagerLayout({ children }) {
  return (
    <RoleShell role="manager" portalLabel="Manager" nav={NAV}>
      {children}
    </RoleShell>
  );
}
