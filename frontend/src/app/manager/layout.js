"use client";

import { LayoutDashboard, Home, Users, UserPlus, CalendarClock, Wrench, ShieldCheck, BarChart3, ListChecks } from "lucide-react";
import RoleShell from "../Shared/RoleShell";

const NAV = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/properties", label: "Properties", icon: Home },
  { href: "/manager/leads", label: "Leads", icon: UserPlus },
  { href: "/manager/viewings", label: "Viewings", icon: CalendarClock },
  { href: "/manager/team", label: "Team", icon: Users },
  { href: "/manager/tasks", label: "My Tasks", icon: ListChecks },
  { href: "/manager/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/manager/compliance", label: "Compliance", icon: ShieldCheck },
  // { href: "/manager/reports", label: "Reports", icon: BarChart3 },
];

export default function ManagerLayout({ children }) {
  return (
    <RoleShell role="manager" portalLabel="Manager" nav={NAV}>
      {children}
    </RoleShell>
  );
}
