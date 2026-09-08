"use client";

import { LayoutDashboard, UserPlus, CalendarClock, ClipboardList, Megaphone, ListChecks } from "lucide-react";
import RoleShell from "../Shared/RoleShell";
import ScreenMonitorToggle from "../Shared/ScreenMonitorToggle";

const NAV = [
  { href: "/agent/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agent/leads", label: "Leads", icon: UserPlus },
  { href: "/agent/viewings", label: "Viewings", icon: CalendarClock },
  // { href: "/agent/applicants", label: "Applicants", icon: ClipboardList },
  { href: "/agent/properties", label: "Properties", icon: Megaphone },
  { href: "/agent/tasks", label: "My Tasks", icon: ListChecks },
];

export default function AgentLayout({ children }) {
  return (
    // A monitored shift can be started from any staff portal; live location
    // stays on the OPERATION seat.
    <RoleShell
      role="agent"
      portalLabel="Agent"
      nav={NAV}
      headerExtra={<ScreenMonitorToggle />}
    >
      {children}
    </RoleShell>
  );
}
