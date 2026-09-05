"use client";

import { LayoutDashboard, UserPlus, CalendarClock, ClipboardList, Megaphone, ListChecks, MapPin } from "lucide-react";
import RoleShell from "../Shared/RoleShell";

// Agents no longer share a live location themselves — only OPERATION does
// (see backend/controllers/agentLocation.controller.js). Agents still read
// the team's Live Location board, same as manager/finance/admin.
const NAV = [
  { href: "/agent/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agent/leads", label: "Leads", icon: UserPlus },
  { href: "/agent/viewings", label: "Viewings", icon: CalendarClock },
  // { href: "/agent/applicants", label: "Applicants", icon: ClipboardList },
  { href: "/agent/properties", label: "Properties", icon: Megaphone },
  { href: "/agent/tasks", label: "My Tasks", icon: ListChecks },
  { href: "/agent/live-location", label: "Live Location", icon: MapPin },
];

export default function AgentLayout({ children }) {
  return (
    <RoleShell role="agent" portalLabel="Agent" nav={NAV}>
      {children}
    </RoleShell>
  );
}
