"use client";

import { LayoutDashboard, CreditCard, UserPlus, CalendarClock, ShieldCheck, BarChart3, ListChecks, MapPin } from "lucide-react";
import RoleShell from "../Shared/RoleShell";
import LiveLocationToggle from "../Shared/LiveLocationToggle";
import ScreenMonitorToggle from "../Shared/ScreenMonitorToggle";

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
    // Both switches live in the header rather than on a page: they have to be
    // reachable from wherever the member happens to be, and visible enough that
    // they always know what is on.
    <RoleShell
      role="operation"
      portalLabel="Operation"
      nav={NAV}
      headerExtra={
        <div className="flex items-center gap-2">
          <LiveLocationToggle />
          <ScreenMonitorToggle />
        </div>
      }
    >
      {children}
    </RoleShell>
  );
}
