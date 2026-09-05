"use client";

import { LayoutDashboard, CreditCard, UserPlus, CalendarClock, ShieldCheck, BarChart3, ListChecks, MapPin } from "lucide-react";
import RoleShell from "../Shared/RoleShell";
import LiveLocationToggle from "../Shared/LiveLocationToggle";

// Invoices and Statements were removed rather than stubbed: this system has no
// Invoice model — a rent charge IS the charge raised, and it lives on the Rent
// & Payments page — and no owner-statement concept exists at all. Both linked
// to pages that were never built, so every item here now resolves.
const NAV = [
  { href: "/operation/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/operation/leads", label: "Leads", icon: UserPlus },
  { href: "/operation/viewings", label: "Viewings", icon: CalendarClock },
  { href: "/operation/tasks", label: "My Tasks", icon: ListChecks },
  { href: "/operation/live-location", label: "Live Location", icon: MapPin },
];

export default function OperationLayout({ children }) {
  return (
    <RoleShell role="operation" portalLabel="Operation" nav={NAV} headerExtra={<LiveLocationToggle />}>
      {children}
    </RoleShell>
  );
}
